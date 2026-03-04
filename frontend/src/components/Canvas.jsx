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
  const [hasDrawnLine, setHasDrawnLine] = useState(false);
  const [timeLeft, setTimeLeft] = useState(drawingTimeLimit);

  // Initialize canvas
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
    if (drawingData) {
      try {
        const lines = JSON.parse(drawingData);
        lines.forEach((line) => {
          drawLineOnCanvas(ctx, line);
        });
      } catch (e) {
        console.error('Error parsing drawing data:', e);
      }
    }
  }, [drawingData]);

  // Timer for drawing turn
  useEffect(() => {
    if (!isYourTurn) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (hasDrawnLine) {
            handleSubmit();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isYourTurn, hasDrawnLine]);

  const drawLineOnCanvas = (ctx, lineData) => {
    if (!lineData.points || lineData.points.length < 2) return;

    ctx.strokeStyle = lineData.color || '#000';
    ctx.lineWidth = lineData.width || 3;
    ctx.beginPath();
    ctx.moveTo(lineData.points[0][0], lineData.points[0][1]);

    for (let i = 1; i < lineData.points.length; i++) {
      ctx.lineTo(lineData.points[i][0], lineData.points[i][1]);
    }
    ctx.stroke();
  };

  const startDrawing = (e) => {
    if (!isYourTurn || !context) return;
    setIsDrawing(true);
    const { offsetX, offsetY } = e.nativeEvent;
    context.beginPath();
    context.moveTo(offsetX, offsetY);
  };

  const draw = (e) => {
    if (!isDrawing || !isYourTurn || !context) return;
    const { offsetX, offsetY } = e.nativeEvent;
    context.lineTo(offsetX, offsetY);
    context.stroke();
  };

  const stopDrawing = (e) => {
    if (!isYourTurn || !context) return;
    setIsDrawing(false);

    // Extract the drawn line from canvas
    const imageData = context.getImageData(
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );

    // Simple check: if there's any non-white pixel, we drew something
    const hasPixels = imageData.data.some((value, index) => {
      // Check alpha channel
      if (index % 4 === 3) {
        return value > 128;
      }
      return false;
    });

    if (hasPixels) {
      setHasDrawnLine(true);
    }
  };

  const handleSubmit = () => {
    if (!hasDrawnLine) {
      alert('Please draw at least one line!');
      return;
    }

    // Get the canvas as image data
    const canvas = canvasRef.current;
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    // For simplicity, we'll send a simplified version of the drawing
    const lineData = {
      drawer_id: 'current_player',
      points: extractCanvasPoints(imageData, canvas.width, canvas.height),
      color: '#000',
      width: 3,
    };

    onSubmit(lineData);
    clearCanvas();
    setHasDrawnLine(false);
    setTimeLeft(drawingTimeLimit);
  };

  const extractCanvasPoints = (imageData, width, height) => {
    // Simple point extraction - sample every 5th drawn pixel
    const points = [];
    let data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4 * 5) {
      if (data[i + 3] > 128) { // Has alpha
        const pixelIndex = i / 4;
        const y = Math.floor(pixelIndex / width);
        const x = pixelIndex % width;
        if (points.length === 0 || 
            Math.abs(points[points.length - 1][0] - x) > 1 ||
            Math.abs(points[points.length - 1][1] - y) > 1) {
          points.push([x, y]);
        }
      }
    }
    
    return points.length > 0 ? points : [[0, 0], [10, 10]];
  };

  const clearCanvas = () => {
    if (!context) return;
    context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    // Redraw existing lines
    if (drawingData) {
      try {
        const lines = JSON.parse(drawingData);
        lines.forEach((line) => {
          drawLineOnCanvas(context, line);
        });
      } catch (e) {
        console.error('Error redrawing:', e);
      }
    }
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
            onClick={clearCanvas}
            className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-bold"
          >
            Clear My Line
          </button>
          <button
            onClick={handleSubmit}
            disabled={!hasDrawnLine}
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

