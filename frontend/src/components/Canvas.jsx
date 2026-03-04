import React, { useRef, useEffect, useState } from 'react';

const Canvas = ({
  onSubmit,
  disabled = false,
  wordToDisplay = '',
  isYourTurn = false,
  currentDrawerName = '',
  drawingData = '[]',
  drawingTimeLimit = 20
}) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState(null);
  const [currentPoints, setCurrentPoints] = useState([]);  // Points of current stroke
  const [timeLeft, setTimeLeft] = useState(drawingTimeLimit);

  // Initialize canvas and redraw existing lines
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000';
    setContext(ctx);

    // Draw existing lines from other players
    redrawAllLines(ctx, drawingData);
  }, [drawingData]);

  // Reset points when turn changes
  useEffect(() => {
    setCurrentPoints([]);
    setTimeLeft(drawingTimeLimit);
  }, [isYourTurn, drawingTimeLimit]);

  // Timer for drawing turn
  useEffect(() => {
    if (!isYourTurn) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isYourTurn]);

  // Auto-submit when time runs out
  useEffect(() => {
    if (timeLeft === 0 && isYourTurn && currentPoints.length >= 2) {
      handleSubmit();
    }
  }, [timeLeft]);

  const redrawAllLines = (ctx, data) => {
    if (!ctx) return;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    try {
      const lines = JSON.parse(data);
      lines.forEach((line) => {
        drawLineOnCanvas(ctx, line);
      });
    } catch (e) {
      console.error('Error parsing drawing data:', e);
    }
  };

  const drawLineOnCanvas = (ctx, lineData) => {
    if (!lineData.points || lineData.points.length < 2) return;

    ctx.save();
    ctx.strokeStyle = lineData.color || '#000';
    ctx.lineWidth = lineData.width || 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lineData.points[0][0], lineData.points[0][1]);

    for (let i = 1; i < lineData.points.length; i++) {
      ctx.lineTo(lineData.points[i][0], lineData.points[i][1]);
    }
    ctx.stroke();
    ctx.restore();
  };

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return [
      (e.clientX - rect.left) * scaleX,
      (e.clientY - rect.top) * scaleY
    ];
  };

  const startDrawing = (e) => {
    if (!isYourTurn || !context) return;
    setIsDrawing(true);
    const pos = getPos(e);
    setCurrentPoints([pos]);
    context.beginPath();
    context.moveTo(pos[0], pos[1]);
  };

  const draw = (e) => {
    if (!isDrawing || !isYourTurn || !context) return;
    const pos = getPos(e);
    setCurrentPoints((prev) => [...prev, pos]);
    context.lineTo(pos[0], pos[1]);
    context.stroke();
  };

  const stopDrawing = () => {
    if (!isYourTurn || !context) return;
    setIsDrawing(false);
  };

  const handleSubmit = () => {
    if (currentPoints.length < 2) {
      alert('Please draw at least one line!');
      return;
    }

    const lineData = {
      points: currentPoints,
      color: '#000',
      width: 3,
    };

    onSubmit(lineData);
    setCurrentPoints([]);
  };

  const clearMyDrawing = () => {
    if (!context) return;
    setCurrentPoints([]);
    // Redraw only the existing shared lines (removes current stroke)
    redrawAllLines(context, drawingData);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Draw This:</h2>
        <p className="text-2xl text-yellow-300 font-bold">{wordToDisplay}</p>

        {isYourTurn ? (
          <div className="mt-4">
            <p className="text-green-300 text-lg font-bold">🎨 Your Turn to Draw!</p>
            <p className="text-red-300 font-bold text-xl mt-2">
              Time: {timeLeft}s
            </p>
            <p className="text-sm text-gray-200 mt-2">Draw ONE line then submit</p>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-blue-300 text-lg font-bold">
              Watching: {currentDrawerName} is drawing...
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
        className={`w-full h-96 border-2 rounded-lg ${
          isYourTurn
            ? 'border-green-400 cursor-crosshair bg-white'
            : 'border-gray-400 cursor-not-allowed bg-gray-100 opacity-75'
        }`}
        disabled={!isYourTurn}
      />

      {isYourTurn && (
        <div className="flex gap-4">
          <button
            onClick={clearMyDrawing}
            className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-bold"
          >
            Clear My Line
          </button>
          <button
            onClick={handleSubmit}
            disabled={currentPoints.length < 2}
            className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-500 font-bold"
          >
            Submit Line
          </button>
        </div>
      )}
    </div>
  );
};

export default Canvas;

