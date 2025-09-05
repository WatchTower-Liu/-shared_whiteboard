export type DrawingTool = 'pen' | 'eraser' | 'rectangle' | 'circle' | 'line';

export interface Point {
  x: number;
  y: number;
}

export interface DrawingElementData {
  tool: DrawingTool;
  color: string;
  strokeWidth: number;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  path?: Point[];  // For pen and eraser strokes
  points?: Point[]; // Alternative name for compatibility
}

export interface MarkdownElementData {
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type WhiteboardElementData = DrawingElementData | MarkdownElementData;

export interface WhiteboardElement {
  id: string;
  type: 'drawing' | 'markdown';
  data: WhiteboardElementData;
  timestamp: number;
  userId: string;
  deleted?: boolean;
}

export interface CursorPosition {
  userId: string;
  x: number;
  y: number;
  color: string;
  name: string;
}

export interface WebSocketMessage {
  type: 'operation' | 'sync' | 'cursor' | 'user_joined' | 'user_left' | 'batch_operations' | 'delete' | 'sync_request' | 'ping' | 'pong';
  data: any;
  userId?: string;
  senderId?: string;
  clientId?: string;
  elementId?: string;
  timestamp?: number;
}