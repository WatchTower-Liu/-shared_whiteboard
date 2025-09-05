import type { WhiteboardElement, WebSocketMessage } from '../types/whiteboard';
import { CRDTManager } from '../utils/crdt';

export class WebSocketService {
  private socket: WebSocket | null = null;
  private onMessageCallback: ((message: any) => void) | null = null;
  private clientId: string;
  private roomId: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private syncRequestInterval: NodeJS.Timeout | null = null; // Only for requesting sync from server
  private currentUrl: string = '';
  
  // Drawing state management
  private isDrawing = false;
  private drawingEndTimeout: NodeJS.Timeout | null = null;
  private pendingOperations: any[] = [];
  private lastSyncTime = 0;

  constructor(clientId: string, roomId: string) {
    this.clientId = clientId;
    this.roomId = roomId;
  }

  connect(url: string): Promise<void> {
    this.currentUrl = url;
    return this.connectToRoom(url, this.roomId);
  }

  private connectToRoom(url: string, roomId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Disconnect existing connection
        this.disconnect();
        
        // Convert http to ws protocol
        const wsUrl = url.replace('http://', 'ws://').replace('https://', 'wss://');
        const fullUrl = `${wsUrl}/ws/${roomId}/${this.clientId}`;
        
        this.socket = new WebSocket(fullUrl);

        this.socket.onopen = () => {
          console.log(`Connected to WebSocket server, room: ${roomId}`);
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.startSyncRequestInterval();
          // Request immediate sync after connection
          this.sendMessage({ type: 'sync_request' });
          resolve();
        };

        this.socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (this.onMessageCallback) {
              this.onMessageCallback(message);
            }
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        };

        this.socket.onclose = () => {
          console.log('Disconnected from WebSocket server');
          this.stopHeartbeat();
          this.stopSyncRequestInterval();
          this.clearDrawingState();
          this.attemptReconnect(url, roomId);
        };

        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  switchRoom(newRoomId: string): Promise<void> {
    console.log(`Switching from room ${this.roomId} to room ${newRoomId}`);
    this.roomId = newRoomId;
    this.reconnectAttempts = 0; // Reset reconnect attempts for new room
    return this.connectToRoom(this.currentUrl, newRoomId);
  }

  private attemptReconnect(url: string, roomId: string): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts && roomId === this.roomId) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => {
        if (roomId === this.roomId) { // Only reconnect if room hasn't changed
          this.connectToRoom(url, roomId).catch(console.error);
        }
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.stopSyncRequestInterval();
    this.clearDrawingState();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        this.sendMessage({ type: 'ping' });
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private startSyncRequestInterval(): void {
    this.syncRequestInterval = setInterval(() => {
      if (this.isConnected() && !this.isDrawing) {
        // Only request sync when not drawing
        this.sendMessage({ type: 'sync_request' });
      }
    }, 10000); // Request sync every 10 seconds
  }

  private stopSyncRequestInterval(): void {
    if (this.syncRequestInterval) {
      clearInterval(this.syncRequestInterval);
      this.syncRequestInterval = null;
    }
  }

  private clearDrawingState(): void {
    this.isDrawing = false;
    this.pendingOperations = [];
    if (this.drawingEndTimeout) {
      clearTimeout(this.drawingEndTimeout);
      this.drawingEndTimeout = null;
    }
  }

  sendMessage(message: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  sendOperation(element: WhiteboardElement): void {
    // Mark as drawing and reset drawing end timeout
    this.markDrawingStart();
    
    // For real-time elements like pen strokes, send immediately but also queue for batch
    if (this.shouldSendImmediately(element)) {
      this.sendMessage({
        type: 'operation',
        data: element
      });
    }
    
    // Queue operation for potential batch sending
    this.pendingOperations.push(element);
    
    // Set timeout to detect end of drawing
    this.scheduleDrawingEnd();
  }

  private shouldSendImmediately(element: WhiteboardElement): boolean {
    // Send pen strokes immediately for real-time feedback
    // But still queue them for batch processing
    return element.type === 'pen';
  }

  private markDrawingStart(): void {
    if (!this.isDrawing) {
      this.isDrawing = true;
      console.log('Drawing started');
    }
  }

  private scheduleDrawingEnd(): void {
    // Clear existing timeout
    if (this.drawingEndTimeout) {
      clearTimeout(this.drawingEndTimeout);
    }
    
    // Set new timeout - if no new operations come in 500ms, consider drawing ended
    this.drawingEndTimeout = setTimeout(() => {
      this.handleDrawingEnd();
    }, 500);
  }

  private handleDrawingEnd(): void {
    if (this.isDrawing) {
      console.log('Drawing ended, syncing operations');
      this.isDrawing = false;
      
      // Send all non-pen operations that weren't sent immediately
      const operationsToSync = this.pendingOperations.filter(op => 
        !this.shouldSendImmediately(op)
      );
      
      if (operationsToSync.length > 0) {
        this.sendMessage({
          type: 'batch_operations',
          data: {
            operations: operationsToSync,
            clientId: this.clientId,
            timestamp: Date.now()
          }
        });
      }
      
      // Clear pending operations
      this.pendingOperations = [];
      this.lastSyncTime = Date.now();
    }
  }

  sendCursor(x: number, y: number): void {
    this.sendMessage({
      type: 'cursor',
      data: {
        cursor: {
          x,
          y,
          clientId: this.clientId
        }
      }
    });
  }

  // Method to manually trigger drawing completion
  forceDrawingEnd(): void {
    if (this.isDrawing) {
      this.handleDrawingEnd();
    }
  }

  // Method to check if currently drawing
  getDrawingState(): boolean {
    return this.isDrawing;
  }

  requestSync(): void {
    // Only request sync if not currently drawing
    if (!this.isDrawing) {
      this.sendMessage({
        type: 'sync_request',
        data: { clientId: this.clientId }
      });
    }
  }

  onMessage(callback: (message: any) => void): void {
    this.onMessageCallback = callback;
  }

  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
}