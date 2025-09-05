import React, { useRef, useEffect, useState } from 'react';
import type { WhiteboardElement, DrawingTool, DrawingElementData } from '../types/whiteboard';
import './Canvas.css';

interface CanvasProps {
  elements: Map<string, WhiteboardElement>;
  selectedTool: DrawingTool;
  selectedColor: string;
  selectedStrokeWidth: number;
  userId: string;
  onElementUpdate: (element: WhiteboardElement) => void;
  disabled?: boolean;
}

const Canvas: React.FC<CanvasProps> = ({
  elements,
  selectedTool,
  selectedColor,
  selectedStrokeWidth,
  userId,
  onElementUpdate,
  disabled = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<Array<{x: number, y: number}>>([]);
  const [startPoint, setStartPoint] = useState<{x: number, y: number} | null>(null);
  const [currentMousePos, setCurrentMousePos] = useState<{x: number, y: number} | null>(null);

  // Redraw main canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Only resize if dimensions actually changed
    if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }

    // Clear and redraw
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    elements.forEach(element => {
      if (element.type === 'drawing' && !element.deleted) {
        drawElement(ctx, element);
      }
    });
  }, [elements]);

  // Setup overlay canvas and handle resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      if (!canvas || !overlayCanvas) return;

      // Store current dimensions
      const newWidth = canvas.offsetWidth;
      const newHeight = canvas.offsetHeight;

      // Only resize if dimensions actually changed
      if (overlayCanvas.width !== newWidth || overlayCanvas.height !== newHeight) {
        overlayCanvas.width = newWidth;
        overlayCanvas.height = newHeight;
      }

      // Also check main canvas
      if (canvas.width !== newWidth || canvas.height !== newHeight) {
        // Save current content
        const imageData = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height);
        
        canvas.width = newWidth;
        canvas.height = newHeight;
        
        // Restore content if existed
        if (imageData && canvas.width > 0 && canvas.height > 0) {
          canvas.getContext('2d')?.putImageData(imageData, 0, 0);
        }
        
        // Force redraw all elements
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          elements.forEach(element => {
            if (element.type === 'drawing' && !element.deleted) {
              drawElement(ctx, element);
            }
          });
        }
      }
    };

    // Initial setup
    handleResize();

    // Add resize listener
    window.addEventListener('resize', handleResize);
    
    // Use ResizeObserver for more reliable detection
    const resizeObserver = new ResizeObserver(handleResize);
    const container = canvasRef.current?.parentElement;
    if (container) {
      resizeObserver.observe(container);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, [elements]);

  // Draw cursor preview and shape preview
  useEffect(() => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas || disabled) return;

    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    // Draw cursor preview for pen and eraser
    if (currentMousePos && !isDrawing && (selectedTool === 'pen' || selectedTool === 'eraser')) {
      const radius = selectedTool === 'eraser' ? selectedStrokeWidth * 3 / 2 : selectedStrokeWidth / 2;
      
      ctx.beginPath();
      ctx.arc(currentMousePos.x, currentMousePos.y, radius, 0, 2 * Math.PI);
      
      if (selectedTool === 'eraser') {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      } else {
        // Convert hex color to rgba for preview
        const r = parseInt(selectedColor.slice(1, 3), 16);
        const g = parseInt(selectedColor.slice(3, 5), 16);
        const b = parseInt(selectedColor.slice(5, 7), 16);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.5)`;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.1)`;
      }
      
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();
    }

    // Draw shape preview while drawing
    if (isDrawing && startPoint && currentMousePos) {
      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = selectedStrokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([5, 5]);

      switch (selectedTool) {
        case 'rectangle':
          ctx.strokeRect(
            startPoint.x,
            startPoint.y,
            currentMousePos.x - startPoint.x,
            currentMousePos.y - startPoint.y
          );
          break;

        case 'circle':
          const radius = Math.sqrt(
            Math.pow(currentMousePos.x - startPoint.x, 2) +
            Math.pow(currentMousePos.y - startPoint.y, 2)
          );
          ctx.beginPath();
          ctx.arc(startPoint.x, startPoint.y, radius, 0, 2 * Math.PI);
          ctx.stroke();
          break;

        case 'line':
          ctx.beginPath();
          ctx.moveTo(startPoint.x, startPoint.y);
          ctx.lineTo(currentMousePos.x, currentMousePos.y);
          ctx.stroke();
          break;
      }

      ctx.setLineDash([]);
    }
  }, [currentMousePos, isDrawing, startPoint, selectedTool, selectedColor, selectedStrokeWidth, disabled]);

  const drawElement = (ctx: CanvasRenderingContext2D, element: WhiteboardElement) => {
    const data = element.data as DrawingElementData;
    const { tool, color, strokeWidth, path, startX, startY, endX, endY } = data;

    // Save context state
    ctx.save();
    
    ctx.strokeStyle = color as string;
    ctx.lineWidth = strokeWidth as number;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (tool) {
      case 'pen':
      case 'eraser':
        if (tool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.lineWidth = (strokeWidth as number) * 3;
        } else {
          ctx.globalCompositeOperation = 'source-over';
        }
        
        if (Array.isArray(path) && path.length > 0) {
          ctx.beginPath();
          ctx.moveTo(path[0].x, path[0].y);
          for (let i = 1; i < path.length; i++) {
            ctx.lineTo(path[i].x, path[i].y);
          }
          ctx.stroke();
        }
        break;

      case 'rectangle':
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeRect(
          startX as number,
          startY as number,
          (endX as number) - (startX as number),
          (endY as number) - (startY as number)
        );
        break;

      case 'circle':
        ctx.globalCompositeOperation = 'source-over';
        const radius = Math.sqrt(
          Math.pow((endX as number) - (startX as number), 2) +
          Math.pow((endY as number) - (startY as number), 2)
        );
        ctx.beginPath();
        ctx.arc(startX as number, startY as number, radius, 0, 2 * Math.PI);
        ctx.stroke();
        break;

      case 'line':
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath();
        ctx.moveTo(startX as number, startY as number);
        ctx.lineTo(endX as number, endY as number);
        ctx.stroke();
        break;
    }
    
    // Restore context state
    ctx.restore();
  };

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    setIsDrawing(true);
    setStartPoint(pos);
    
    if (selectedTool === 'pen' || selectedTool === 'eraser') {
      setCurrentPath([pos]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    setCurrentMousePos(pos);
    
    if (!isDrawing) return;
    
    if (selectedTool === 'pen' || selectedTool === 'eraser') {
      setCurrentPath(prev => [...prev, pos]);
      
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Save context state
          ctx.save();
          
          ctx.strokeStyle = selectedColor;
          ctx.lineWidth = selectedTool === 'eraser' ? selectedStrokeWidth * 3 : selectedStrokeWidth;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          if (selectedTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
          } else {
            ctx.globalCompositeOperation = 'source-over';
          }
          
          ctx.beginPath();
          if (currentPath.length > 0) {
            ctx.moveTo(currentPath[currentPath.length - 1].x, currentPath[currentPath.length - 1].y);
          }
          ctx.lineTo(pos.x, pos.y);
          ctx.stroke();
          
          // Restore context state
          ctx.restore();
        }
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint) return;
    
    const pos = getMousePos(e);
    setIsDrawing(false);
    
    const element: WhiteboardElement = {
      id: `draw-${Date.now()}-${userId}`,
      type: 'drawing',
      data: {
        tool: selectedTool,
        color: selectedColor,
        strokeWidth: selectedStrokeWidth,
        startX: startPoint.x,
        startY: startPoint.y,
        endX: pos.x,
        endY: pos.y,
        path: currentPath
      } as DrawingElementData,
      timestamp: Date.now(),
      userId
    };
    
    onElementUpdate(element);
    setCurrentPath([]);
    setStartPoint(null);
  };

  const handleMouseLeave = () => {
    setCurrentMousePos(null);
    if (isDrawing) {
      handleMouseUp({} as React.MouseEvent<HTMLCanvasElement>);
    }
  };

  return (
    <div className="canvas-container" data-tool={selectedTool}>
      <canvas
        ref={canvasRef}
        className="whiteboard-canvas"
      />
      <canvas
        ref={overlayCanvasRef}
        className="whiteboard-canvas-overlay"
        style={{ pointerEvents: disabled ? 'none' : 'all' }}
        onMouseDown={disabled ? undefined : handleMouseDown}
        onMouseMove={disabled ? undefined : handleMouseMove}
        onMouseUp={disabled ? undefined : handleMouseUp}
        onMouseLeave={disabled ? undefined : handleMouseLeave}
      />
    </div>
  );
};

export default Canvas;