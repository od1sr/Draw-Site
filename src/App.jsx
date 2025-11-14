import { useRef, useState, useEffect } from "react";

export default function DrawingApp() {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState("pen"); // pen | rect | circle | line | eraser
  const [color, setColor] = useState("#FFFFFF");
  const [size, setSize] = useState(3);
  const [startPos, setStartPos] = useState(null);
  const [canvasSize, setCanvasSize] = useState(0);
  const [savedImage, setSavedImage] = useState(null);
  const [mode, setMode] = useState("drawing"); // drawing | viewing
  const [receivedImages, setReceivedImages] = useState(null);
  const [currentViewIndex, setCurrentViewIndex] = useState(0);
  const viewModes = ["Очищенное", "Тепловая карта", "Контуры"];

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

  // Эффект для отрисовки и очистки холста
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (mode === "viewing" && receivedImages) {
      const { cleaned, heatmap, overlay } = receivedImages;
      switch (currentViewIndex) {
        case 0: // Очищенное
          drawLayers(cleaned);
          break;
        case 1: // Тепловая карта
          drawLayers(heatmap);
          break;
        case 2: // Контуры
          drawLayers(overlay);
          break;
        default:
          clearCanvas();
      }
    } else if (mode === "drawing") {
      clearCanvas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentViewIndex, mode, receivedImages, canvasSize]);

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
      ctx.fill();
      ctx.stroke(); 
    }
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const originalFillStyle = ctx.fillStyle;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = originalFillStyle;
  };

  const drawLayers = (base, top, overlay, topAlpha = 1.0) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const loadImage = (base64) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = `data:image/png;base64,${base64}`;
      });
    };

    // Очищаем холст перед отрисовкой новых слоев
    const originalFillStyle = ctx.fillStyle;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = originalFillStyle;

    const imagesToLoad = [loadImage(base)];
    if (top) imagesToLoad.push(loadImage(top));
    if (overlay) imagesToLoad.push(loadImage(overlay));

    Promise.all(imagesToLoad)
      .then(([baseImg, topImg, overlayImg]) => {
        // 1. Отрисовываем базовый слой
        ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);

        // 2. Накладываем верхний слой (heatmap) с прозрачностью
        if (topImg) {
          ctx.globalAlpha = topAlpha;
          ctx.drawImage(topImg, 0, 0, canvas.width, canvas.height);
          ctx.globalAlpha = 1.0; // Сбрасываем прозрачность
        }

        // 3. Накладываем контуры
        if (overlayImg) {
          ctx.drawImage(overlayImg, 0, 0, canvas.width, canvas.height);
        }

        setSavedImage(null); // Сбрасываем сохраненное состояние
      })
      .catch((error) => console.error("Ошибка при загрузке изображений для слоев:", error));
  };

  const saveImage = async () => {
    const originalCanvas = canvasRef.current;

    // Создаем временный холст для сжатия
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = 64;
    tempCanvas.height = 64;
    const tempCtx = tempCanvas.getContext("2d");

    // Рисуем оригинальное изображение на временном холсте
    tempCtx.drawImage(originalCanvas, 0, 0, 64, 64);

    const dataURL = tempCanvas.toDataURL("image/png");

    try {
      const response = await fetch('https://c1600d67dbacbd.lhr.life/upload-image', { // Не забудьте обновить URL, если он изменится
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          image: dataURL,
          user_id: window.Telegram?.WebApp?.initDataUnsafe?.user?.id ?? null
        })
      });

      if (!response.ok) {
        console.error("Ошибка ответа сервера:", response.status, response.statusText);
      } else {
          const data = await response.json();
          if (data.success && data.cleaned && data.heatmap && data.overlay) {
            setReceivedImages(data);
            setCurrentViewIndex(0); // Начинаем с комбинированного вида
            setMode("viewing");
          }
      }
    } catch (error) {
      console.error("Ошибка сети при отправке:", error);
    }
  };

  const handleReturnToDraw = () => {
    setMode("drawing");
    setReceivedImages(null);
    clearCanvas();
  };

  const handleNextView = () => {
    setCurrentViewIndex((prev) => (prev + 1) % viewModes.length);
  };

  const handlePrevView = () => {
    setCurrentViewIndex(
      (prev) => (prev - 1 + viewModes.length) % viewModes.length
    );
  };

  return (
    <div className="flex flex-col items-center justify-between h-screen bg-gray-100 p-2">
      <div className="flex-1 flex items-center justify-center w-full">
        <canvas
          ref={canvasRef}
          width={canvasSize}
          height={canvasSize}
          className="bg-black border border-gray-400 rounded-lg"
          style={{ touchAction: mode === 'drawing' ? 'none' : 'auto' }}
          onMouseDown={mode === 'drawing' ? startDrawing : undefined}
          onMouseMove={mode === 'drawing' ? draw : undefined}
          onMouseUp={mode === 'drawing' ? stopDrawing : undefined}
          onMouseLeave={mode === 'drawing' ? stopDrawing : undefined}
          onTouchStart={mode === 'drawing' ? startDrawing : undefined}
          onTouchMove={mode === 'drawing' ? draw : undefined}
          onTouchEnd={mode === 'drawing' ? stopDrawing : undefined}
        />
      </div>

      <div
        className="flex flex-wrap justify-center gap-2 p-3 bg-white shadow-md rounded-t-xl"
        style={{ width: canvasSize}}
      >
        {mode === "drawing" ? (
          <>
            <button onClick={() => setTool("pen")} className={`px-3 py-2 rounded ${tool === "pen" ? "bg-blue-500 text-white" : "bg-gray-200"}`}>✏️</button>
            <button onClick={() => setTool("rect")} className={`px-3 py-2 rounded ${tool === "rect" ? "bg-blue-500 text-white" : "bg-gray-200"}`}>⬛</button>
            <button onClick={() => setTool("circle")} className={`px-3 py-2 rounded ${tool === "circle" ? "bg-blue-500 text-white" : "bg-gray-200"}`}>⚪</button>
            <button onClick={() => setTool("line")} className={`px-3 py-2 rounded ${tool === "line" ? "bg-blue-500 text-white" : "bg-gray-200"}`}>➖</button>
            <input 
              type="color" 
              value={color} 
              onChange={(e) => setColor(e.target.value)} 
              className="w-10 h-10 border rounded"
            />
            <input type="range" min="1" max="20" value={size} onChange={(e) => setSize(e.target.value)} />
            <button onClick={clearCanvas} className="px-3 py-2 bg-red-500 text-white rounded">🧹</button>
            <button onClick={saveImage} className="px-3 py-2 bg-green-500 text-white rounded">✅</button>
          </>
        ) : (
          <div className="flex flex-col w-full h-full gap-2"> {/* Main container for viewing mode controls */}
            <div className="flex items-center justify-between w-full flex-grow"> {/* Row for Prev, Center Column, Next */}
              <button onClick={handlePrevView} className="w-16 flex-shrink-0 h-full bg-gray-300 rounded-lg text-4xl flex items-center justify-center">
                ⬅️
              </button>
              <div className="flex flex-col items-center justify-center flex-grow h-full px-4 gap-2"> {/* Center column for title and OK button */}
                <span className="font-semibold text-lg text-center">
                  {viewModes[currentViewIndex]}
                </span>
                <button onClick={handleReturnToDraw} className="px-4 py-2 bg-slate-500 text-white rounded w-full">
                  Назад
                </button>
              </div>
              <button onClick={handleNextView} className="w-16 flex-shrink-0 h-full bg-gray-300 rounded-lg text-4xl flex items-center justify-center">
                ➡️
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
