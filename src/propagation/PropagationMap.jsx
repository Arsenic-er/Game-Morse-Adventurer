import { useEffect, useRef } from "react";
import { locationFromNormalizedPoint } from "./propagationEngine.js";

const BASE_MAP = "./assets/world-map.png";
const LEVEL_COLORS = ["#1597a4", "#16895f", "#d7c632", "#ef7b20", "#dd352f"];

export function PropagationMap({ map, mode = "propagation", onSelect, ariaLabel = "Propagation map", className = "" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !map) return undefined;
    const context = canvas.getContext("2d", { alpha: false });
    let cancelled = false;
    const base = new Image();
    base.src = BASE_MAP;
    base.onload = () => {
      if (cancelled) return;
      context.imageSmoothingEnabled = false;
      context.fillStyle = "#03111a";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(base, 0, 0, canvas.width, canvas.height);

      if (mode === "propagation") {
        const cellWidth = canvas.width / map.gridWidth;
        const cellHeight = canvas.height / map.gridHeight;
        context.globalAlpha = .78;
        for (let y = 0; y < map.gridHeight; y += 1) {
          for (let x = 0; x < map.gridWidth; x += 1) {
            context.fillStyle = LEVEL_COLORS[map.cells[y * map.gridWidth + x]];
            context.fillRect(Math.floor(x * cellWidth), Math.floor(y * cellHeight), Math.ceil(cellWidth), Math.ceil(cellHeight));
          }
        }
        context.globalAlpha = .3;
        context.drawImage(base, 0, 0, canvas.width, canvas.height);
        context.globalAlpha = 1;
      }

      const player = map.playerLocation;
      if (player) {
        const px = (player.longitude + 180) / 360 * canvas.width;
        const py = (90 - player.latitude) / 180 * canvas.height;
        context.fillStyle = "#061015";
        context.fillRect(Math.round(px) - 7, Math.round(py) - 7, 14, 14);
        context.strokeStyle = "#f4d25c";
        context.lineWidth = 3;
        context.strokeRect(Math.round(px) - 6, Math.round(py) - 6, 12, 12);
      }
    };
    return () => { cancelled = true; };
  }, [map, mode]);

  function handlePointer(event) {
    if (!onSelect || !canvasRef.current) return;
    const bounds = canvasRef.current.getBoundingClientRect();
    onSelect(locationFromNormalizedPoint((event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height));
  }

  return <canvas ref={canvasRef} className={`propagation-canvas ${className}`} width="720" height="360" role="img" aria-label={ariaLabel} onPointerDown={handlePointer} />;
}
