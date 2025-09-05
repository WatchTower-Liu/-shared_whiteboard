import React, { useEffect, useRef, useState } from 'react';
import Canvas from './Canvas';
import MarkdownEditor from './MarkdownEditor';
import type { WhiteboardElement, DrawingTool, MarkdownElementData } from '../types/whiteboard';
import { WebSocketService } from '../services/websocket';
import { CRDTManager } from '../utils/crdt';
import './Whiteboard.css';

interface WhiteboardProps {
  roomId: string;
  userId: string;
}

const Whiteboard: React.FC<WhiteboardProps> = ({ roomId, userId }) => {
  const [elements, setElements] = useState<Map<string, WhiteboardElement>>(new Map());
  const [selectedTool, setSelectedTool] = useState<DrawingTool>('pen');
  const [selectedColor, setSelectedColor] = useState('#ffffff');
  const [selectedStrokeWidth, setSelectedStrokeWidth] = useState(2);
  const [isAddingMarkdown, setIsAddingMarkdown] = useState(false);
  const [markdownPosition, setMarkdownPosition] = useState<{x: number, y: number} | null>(null);
  const [showMarkdownPrompt, setShowMarkdownPrompt] = useState(false);
  const placementOverlayRef = useRef<HTMLDivElement>(null);
  
  const wsService = useRef<WebSocketService | null>(null);
  const crdtManager = useRef<CRDTManager | null>(null);
  const currentRoomId = useRef<string>(roomId);

  // Initialize WebSocket service
  useEffect(() => {
    if (!wsService.current) {
      crdtManager.current = new CRDTManager(userId);
      wsService.current = new WebSocketService(userId, roomId);
      
      wsService.current.onMessage((message) => {
        if (message.type === 'sync') {
          const state = message.data.state;
          const newElements = new Map<string, WhiteboardElement>();
          
          // Clear CRDT manager state when syncing new room
          if (crdtManager.current) {
            crdtManager.current = new CRDTManager(userId);
            Object.entries(state).forEach(([id, element]) => {
              const el = element as WhiteboardElement;
              crdtManager.current!.applyOperation(el);
              newElements.set(id, el);
            });
          } else {
            Object.entries(state).forEach(([id, element]) => {
              newElements.set(id, element as WhiteboardElement);
            });
          }
          
          setElements(newElements);
        } else if (message.type === 'operation') {
          const operation = message.data;
          if (crdtManager.current && message.senderId !== userId) {
            crdtManager.current.applyOperation(operation);
            setElements(new Map(crdtManager.current.getState()));
          }
        } else if (message.type === 'batch_operations') {
          const operations = message.data.operations;
          if (crdtManager.current && message.data.senderId !== userId) {
            // Apply all operations in the batch
            operations.forEach((operation: WhiteboardElement) => {
              crdtManager.current!.applyOperation(operation);
            });
            setElements(new Map(crdtManager.current.getState()));
          }
        } else if (message.type === 'delete') {
          if (crdtManager.current) {
            crdtManager.current.deleteElement(message.elementId);
          }
          setElements(prev => {
            const newMap = new Map(prev);
            newMap.delete(message.elementId);
            return newMap;
          });
        }
      });

      wsService.current.connect(window.location.origin).then(() => {
        wsService.current?.sendMessage({ type: 'sync_request' });
      });
    }

    return () => {
      wsService.current?.disconnect();
      wsService.current = null;
    };
  }, []);

  // Handle room changes
  useEffect(() => {
    if (wsService.current && currentRoomId.current !== roomId) {
      console.log(`Room changed from ${currentRoomId.current} to ${roomId}`);
      currentRoomId.current = roomId;
      
      // Clear current elements and reset CRDT state
      setElements(new Map());
      if (crdtManager.current) {
        crdtManager.current = new CRDTManager(userId);
      }
      
      // Switch to new room
      wsService.current.switchRoom(roomId).then(() => {
        wsService.current?.sendMessage({ type: 'sync_request' });
      }).catch(error => {
        console.error('Failed to switch room:', error);
      });
    }
  }, [roomId, userId]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only handle left click for placing markdown
    if (isAddingMarkdown && e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
      
      const container = document.querySelector('.whiteboard-content');
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      setMarkdownPosition({ x, y });
      setShowMarkdownPrompt(true);
      setIsAddingMarkdown(false);
    }
  };

  const handleCanvasRightClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Right click to cancel markdown placement
    if (isAddingMarkdown) {
      e.preventDefault();
      e.stopPropagation();
      setIsAddingMarkdown(false);
      setShowMarkdownPrompt(false);
      setMarkdownPosition(null);
      return false;
    }
  };

  const handleAddMarkdownClick = () => {
    setIsAddingMarkdown(true);
    setShowMarkdownPrompt(false);
    setMarkdownPosition(null);
  };

  const handleMarkdownSave = (content: string, x: number, y: number, elementId?: string) => {
    if (crdtManager.current && wsService.current) {
      const element: WhiteboardElement = {
        id: elementId || `md-${Date.now()}-${userId}`,
        type: 'markdown',
        data: {
          content,
          x,
          y,
          width: 300,
          height: 200
        } as MarkdownElementData,
        timestamp: Date.now(),
        userId
      };
      
      crdtManager.current.applyOperation(element);
      wsService.current.sendMessage({
        type: 'operation',
        data: element
      });
      setElements(new Map(crdtManager.current.getState()));
      setIsAddingMarkdown(false);
      setShowMarkdownPrompt(false);
      setMarkdownPosition(null);
    }
  };

  const handleDrawingUpdate = (element: WhiteboardElement) => {
    if (crdtManager.current && wsService.current) {
      crdtManager.current.applyOperation(element);
      wsService.current.sendMessage({
        type: 'operation',
        data: element
      });
      setElements(new Map(crdtManager.current.getState()));
    }
  };

  return (
    <div className="whiteboard-container">
      <div className="toolbar">
        <div className="tool-group">
          <button 
            className={selectedTool === 'pen' ? 'active' : ''}
            onClick={() => setSelectedTool('pen')}
          >
            ✏️ Pen
          </button>
          <button 
            className={selectedTool === 'eraser' ? 'active' : ''}
            onClick={() => setSelectedTool('eraser')}
          >
            🧹 Eraser
          </button>
          <button 
            className={selectedTool === 'rectangle' ? 'active' : ''}
            onClick={() => setSelectedTool('rectangle')}
          >
            ⬜ Rectangle
          </button>
          <button 
            className={selectedTool === 'circle' ? 'active' : ''}
            onClick={() => setSelectedTool('circle')}
          >
            ⭕ Circle
          </button>
          <button 
            className={selectedTool === 'line' ? 'active' : ''}
            onClick={() => setSelectedTool('line')}
          >
            📏 Line
          </button>
        </div>
        
        <div className="tool-group">
          <input 
            type="color" 
            value={selectedColor}
            onChange={(e) => setSelectedColor(e.target.value)}
          />
          <label>
            Width: 
            <input 
              type="range" 
              min="1" 
              max="20" 
              value={selectedStrokeWidth}
              onChange={(e) => setSelectedStrokeWidth(Number(e.target.value))}
            />
            {selectedStrokeWidth}px
          </label>
        </div>
        
        <div className="tool-group">
          <button 
            className={`markdown-btn ${isAddingMarkdown ? 'active' : ''}`}
            onClick={handleAddMarkdownClick}
          >
            📝 Add Markdown
          </button>
        </div>
      </div>
      
      <div 
        className={`whiteboard-content ${isAddingMarkdown ? 'adding-markdown' : ''}`}
      >
        {isAddingMarkdown && (
          <div 
            ref={placementOverlayRef}
            className="markdown-placement-overlay"
            onMouseDown={handleCanvasClick}
            onContextMenu={handleCanvasRightClick}
          />
        )}
        <Canvas
          elements={elements}
          selectedTool={selectedTool}
          selectedColor={selectedColor}
          selectedStrokeWidth={selectedStrokeWidth}
          userId={userId}
          onElementUpdate={handleDrawingUpdate}
          disabled={isAddingMarkdown}
        />
        
        {Array.from(elements.values())
          .filter(el => el.type === 'markdown')
          .map(el => (
            <MarkdownEditor
              key={el.id}
              id={el.id}
              initialContent={(el.data as MarkdownElementData).content}
              x={(el.data as MarkdownElementData).x}
              y={(el.data as MarkdownElementData).y}
              onSave={(content) => handleMarkdownSave(content, (el.data as MarkdownElementData).x, (el.data as MarkdownElementData).y, el.id)}
              onDelete={() => {
                if (crdtManager.current && wsService.current) {
                  wsService.current.sendMessage({
                    type: 'delete',
                    elementId: el.id
                  });
                  crdtManager.current.deleteElement(el.id);
                  setElements(new Map(crdtManager.current.getState()));
                }
              }}
            />
          ))}
        
        {showMarkdownPrompt && markdownPosition && (
          <MarkdownEditor
            id={`temp-${Date.now()}`}
            initialContent=""
            x={markdownPosition.x}
            y={markdownPosition.y}
            onSave={(content) => handleMarkdownSave(content, markdownPosition.x, markdownPosition.y)}
            onDelete={() => {
              setShowMarkdownPrompt(false);
              setMarkdownPosition(null);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default Whiteboard;