/**
 * Canvas.jsx — Resolution-independent drawing canvas with real-time broadcast.
 *
 * Each stroke is sent to the server on mouseup so all players see it live.
 * "Done Drawing" signals the end of the drawer's turn and advances to the
 * next player.
 *
 * Uses ResizeObserver for responsive resize handling.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';

// ─── Constants ───────────────────────────────────────────────────────────────

const CANVAS_LOGICAL_W = 800;
const CANVAS_LOGICAL_H = 600;
const DEFAULT_COLOR = '#000';
const DEFAULT_WIDTH = 3;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert client coords → normalized [0,1] */
function clientToNorm(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  return [
    (e.clientX - rect.left) / rect.width,
    (e.clientY - rect.top) / rect.height,
  ];
}

/** Draw one stroke (normalized coords) onto a canvas context */
function renderStroke(ctx, stroke, w, h) {
  const pts = stroke.points;
  if (!pts || pts.length < 2) return;

  ctx.save();
  ctx.strokeStyle = stroke.color || DEFAULT_COLOR;
  ctx.lineWidth = (stroke.width || DEFAULT_WIDTH) * (w / CANVAS_LOGICAL_W);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0][0] * w, pts[0][1] * h);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i][0] * w, pts[i][1] * h);
  }
  ctx.stroke();
  ctx.restore();
}

/** Redraw all committed strokes */
function renderAllStrokes(ctx, strokes, w, h) {
  ctx.clearRect(0, 0, w, h);
  strokes.forEach((s) => renderStroke(ctx, s, w, h));
}

// ─── Component ───────────────────────────────────────────────────────────────

const Canvas = ({
  onStroke,                // called with stroke data on each mouseup (real-time)
  onFinish,                // called when drawer clicks "Done Drawing"
  wordToDisplay = '',
  isYourTurn = false,
  currentDrawerName = '',
  strokes = [],            // Array of { points, color, width, … }
  drawingTimeLimit = 20,
}) => {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState([]);   // normalized (for effect redraw)
  const [timeLeft, setTimeLeft] = useState(drawingTimeLimit);
  const sizeRef = useRef({ w: CANVAS_LOGICAL_W, h: CANVAS_LOGICAL_H });
  const currentPointsRef = useRef([]);       // mirror for stale-closure safety
  const finishedRef = useRef(false);         // prevent double-finish

  // Keep ref in sync with state
  useEffect(() => { currentPointsRef.current = currentPoints; }, [currentPoints]);

  // ── Canvas setup (runs once) ─────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const setSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      canvas.width = w;
      canvas.height = h;
      sizeRef.current = { w, h };

      const ctx = canvas.getContext('2d');
      ctxRef.current = ctx;
      renderAllStrokes(ctx, strokes, w, h);
    };

    setSize();

    const observer = new ResizeObserver(() => setSize());
    observer.observe(canvas);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Redraw when strokes change (from server broadcast) ────────────────
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    renderAllStrokes(ctx, strokes, w, h);

    // Re-draw the in-progress stroke on top (if the drawer is mid-stroke)
    if (currentPointsRef.current.length >= 2) {
      renderStroke(ctx, { points: currentPointsRef.current, color: DEFAULT_COLOR, width: DEFAULT_WIDTH }, w, h);
    }
  }, [strokes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset local state when turn changes ──────────────────────────────
  useEffect(() => {
    setCurrentPoints([]);
    currentPointsRef.current = [];
    setTimeLeft(drawingTimeLimit);
    finishedRef.current = false;
  }, [isYourTurn, drawingTimeLimit]);

  // ── Timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isYourTurn) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isYourTurn]);

  // ── Auto-finish on timeout ───────────────────────────────────────────
  useEffect(() => {
    if (timeLeft === 0 && isYourTurn && !finishedRef.current) {
      finishedRef.current = true;
      const pts = currentPointsRef.current;
      if (pts.length >= 2) {
        onStroke({ points: [...pts], color: DEFAULT_COLOR, width: DEFAULT_WIDTH });
        setCurrentPoints([]);
        currentPointsRef.current = [];
      }
      onFinish();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  // ── Drawing handlers ─────────────────────────────────────────────────
  const startDrawing = useCallback((e) => {
    if (!isYourTurn || finishedRef.current) return;
    setIsDrawing(true);
    const pt = clientToNorm(e, canvasRef.current);
    setCurrentPoints([pt]);
    currentPointsRef.current = [pt];

    const ctx = ctxRef.current;
    const { w, h } = sizeRef.current;
    ctx.beginPath();
    ctx.strokeStyle = DEFAULT_COLOR;
    ctx.lineWidth = DEFAULT_WIDTH * (w / CANVAS_LOGICAL_W);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(pt[0] * w, pt[1] * h);
  }, [isYourTurn]);

  const draw = useCallback((e) => {
    if (!isDrawing || !isYourTurn) return;
    const pt = clientToNorm(e, canvasRef.current);
    setCurrentPoints((prev) => [...prev, pt]);
    currentPointsRef.current.push(pt);

    const ctx = ctxRef.current;
    const { w, h } = sizeRef.current;
    ctx.lineTo(pt[0] * w, pt[1] * h);
    ctx.stroke();
  }, [isDrawing, isYourTurn]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);

    // Immediately send the completed stroke to the server
    const pts = currentPointsRef.current;
    if (pts.length >= 2) {
      onStroke({ points: [...pts], color: DEFAULT_COLOR, width: DEFAULT_WIDTH });
    }
    setCurrentPoints([]);
    currentPointsRef.current = [];
  }, [isDrawing, onStroke]);

  // ── Touch handlers (for mobile/tablet) ────────────────────────────────
  const startDrawingTouch = useCallback((e) => {
    e.preventDefault();
    if (!isYourTurn || finishedRef.current) return;
    const touch = e.touches[0];
    const syntheticEvent = { clientX: touch.clientX, clientY: touch.clientY };
    startDrawing(syntheticEvent);
  }, [isYourTurn, startDrawing]);

  const drawTouch = useCallback((e) => {
    e.preventDefault();
    if (!isDrawing || !isYourTurn) return;
    const touch = e.touches[0];
    const syntheticEvent = { clientX: touch.clientX, clientY: touch.clientY };
    draw(syntheticEvent);
  }, [isDrawing, isYourTurn, draw]);

  const stopDrawingTouch = useCallback((e) => {
    e.preventDefault();
    stopDrawing();
  }, [stopDrawing]);

  // ── Done Drawing ─────────────────────────────────────────────────────
  const handleFinish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    // Flush any in-progress stroke
    const pts = currentPointsRef.current;
    if (pts.length >= 2) {
      onStroke({ points: [...pts], color: DEFAULT_COLOR, width: DEFAULT_WIDTH });
      setCurrentPoints([]);
      currentPointsRef.current = [];
    }
    onFinish();
  };

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Draw This:</h2>
        <p className="text-2xl text-yellow-300 font-bold">{wordToDisplay}</p>

        {isYourTurn ? (
          <div className="mt-4">
            <p className="text-green-300 text-lg font-bold">🎨 Your Turn to Draw!</p>
            <p className="text-red-300 font-bold text-xl mt-2">Time: {timeLeft}s</p>
            <p className="text-sm text-gray-200 mt-2">
              Draw freely — others see your strokes in real time
            </p>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-blue-300 text-lg font-bold">
              Watching: {currentDrawerName} is drawing…
            </p>
            <p className="text-sm text-gray-200">You cannot draw right now</p>
          </div>
        )}
      </div>

      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawingTouch}
        onTouchMove={drawTouch}
        onTouchEnd={stopDrawingTouch}
        onTouchCancel={stopDrawingTouch}
        className={`w-full h-96 rounded-lg ${
          isYourTurn
            ? 'border-2 border-green-400 cursor-crosshair bg-white'
            : 'border-2 border-gray-400 cursor-not-allowed bg-gray-100 opacity-75'
        }`}
      />

      {isYourTurn && (
        <div className="flex gap-4">
          <button
            onClick={handleFinish}
            className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-bold text-lg"
          >
            ✅ Done Drawing
          </button>
        </div>
      )}
    </div>
  );
};

export default Canvas;
