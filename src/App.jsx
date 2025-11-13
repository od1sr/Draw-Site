import { useRef, useState, useEffect } from "react";

export default function DrawingApp() {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState("pen"); // pen | rect | circle | line | eraser
  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(3);
  const [startPos, setStartPos] = useState(null);
  const [canvasSize, setCanvasSize] = useState(0);
  const [savedImage, setSavedImage] = useState(null);

  // динамически подгоняем размер холста
  useEffect(() => {
    const resize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setCanvasSize(Math.min(width, height * 0.8)); // квадрат по центру
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // универсальные координаты для мыши и тача
  const getCoords = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const pos = getCoords(e);
    const ctx = canvasRef.current.getContext("2d");

    if (tool === "pen") {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }else{
      // сохранить текущее состояние холста
      const snapshot = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
      setSavedImage(snapshot);
    }

    setStartPos(pos);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current.getContext("2d");
    const pos = getCoords(e);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (tool === "pen") {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else {
      // восстановить холст в исходное состояние
      if (savedImage) ctx.putImageData(savedImage, 0, 0);

      const dx = pos.x - startPos.x;
      const dy = pos.y - startPos.y;

      ctx.beginPath();
      if (tool === "rect") {
        ctx.rect(startPos.x, startPos.y, dx, dy);
      } else if (tool === "circle") {
        const r = Math.sqrt(dx * dx + dy * dy);
        ctx.arc(startPos.x, startPos.y, r, 0, 2 * Math.PI);
      } else if(tool === "line"){
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(pos.x, pos.y);
      }
      ctx.fill();   // заливаем
      ctx.stroke(); // можно убрать, если нужен только fill
    }
  };

  const stopDrawing = () => setIsDrawing(false);

  const handleMouseLeave = () => {

  };

  const clearCanvas = () => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const saveImage = () => {
    const canvas = canvasRef.current;
    const link = document.createElement("a");
    link.download = "drawing.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="flex flex-col items-center justify-between h-screen bg-gray-100 p-2">
      <div className="flex-1 flex items-center justify-center w-full">
        <canvas
          ref={canvasRef}
          width={canvasSize}
          height={canvasSize}
          className="bg-white border border-gray-400 rounded-lg touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={handleMouseLeave}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>

      <div className="flex flex-wrap justify-center gap-2 p-3 bg-white shadow-md w-full rounded-t-xl">
        <button onClick={() => setTool("pen")} className={`px-3 py-2 rounded ${tool === "pen" ? "bg-blue-500 text-white" : "bg-gray-200"}`}>✏️</button>
        <button onClick={() => setTool("rect")} className={`px-3 py-2 rounded ${tool === "rect" ? "bg-blue-500 text-white" : "bg-gray-200"}`}>⬛</button>
        <button onClick={() => setTool("circle")} className={`px-3 py-2 rounded ${tool === "circle" ? "bg-blue-500 text-white" : "bg-gray-200"}`}>⚪</button>
        <button onClick={() => setTool("line")} className={`px-3 py-2 rounded ${tool === "line" ? "bg-blue-500 text-white" : "bg-gray-200"}`}>➖</button>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-10 border rounded" />
        <input type="range" min="1" max="20" value={size} onChange={(e) => setSize(e.target.value)} />
        <button onClick={clearCanvas} className="px-3 py-2 bg-red-500 text-white rounded">🧹</button>
        <button onClick={saveImage} className="px-3 py-2 bg-green-500 text-white rounded">✅</button>
      </div>
    </div>
  );
}
