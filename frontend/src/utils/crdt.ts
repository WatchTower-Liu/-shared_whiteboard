import type { WhiteboardElement, Point, DrawingElementData, MarkdownElementData } from '../types/whiteboard';

export class CRDTManager {
  private elements: Map<string, WhiteboardElement> = new Map();
  private userId: string;
  private vector: Map<string, number> = new Map();

  constructor(userId: string) {
    this.userId = userId;
    this.vector.set(userId, 0);
  }

  applyOperation(element: WhiteboardElement): boolean {
    const existingElement = this.elements.get(element.id);
    
    // If element is marked as deleted, remove it
    if (element.deleted) {
      if (!existingElement || element.timestamp > existingElement.timestamp) {
        this.elements.delete(element.id);
        this.updateVectorClock(element.userId);
        return true;
      }
      return false;
    }
    
    // If no existing element or new element is newer, apply it
    if (!existingElement || this.shouldApplyOperation(element, existingElement)) {
      this.elements.set(element.id, element);
      this.updateVectorClock(element.userId);
      return true;
    }
    
    return false;
  }

  private shouldApplyOperation(newElement: WhiteboardElement, existingElement: WhiteboardElement): boolean {
    // Enhanced conflict resolution strategy
    
    // 1. If timestamps differ significantly (more than 1 second), use timestamp
    const timeDiff = Math.abs(newElement.timestamp - existingElement.timestamp);
    if (timeDiff > 1000) {
      return newElement.timestamp > existingElement.timestamp;
    }
    
    // 2. For concurrent operations (similar timestamps), use element-specific logic
    if (this.areConcurrent(newElement, existingElement)) {
      return this.resolveConcurrentConflict(newElement, existingElement);
    }
    
    // 3. Default Last-Write-Wins (LWW) strategy
    if (newElement.timestamp > existingElement.timestamp) {
      return true;
    } else if (newElement.timestamp === existingElement.timestamp) {
      // If timestamps are equal, use userId as tiebreaker for consistency
      return newElement.userId > existingElement.userId;
    }
    return false;
  }
  
  private areConcurrent(element1: WhiteboardElement, element2: WhiteboardElement): boolean {
    // Consider operations concurrent if timestamps are within 500ms
    const timeDiff = Math.abs(element1.timestamp - element2.timestamp);
    return timeDiff <= 500;
  }
  
  private resolveConcurrentConflict(newElement: WhiteboardElement, existingElement: WhiteboardElement): boolean {
    // Special handling for different element types during concurrent operations
    
    // For drawing elements, prefer the most recent stroke segment
    if (newElement.type === 'drawing' && existingElement.type === 'drawing') {
      const newData = newElement.data as DrawingElementData;
      const existingData = existingElement.data as DrawingElementData;
      
      // For pen/eraser strokes
      if (newData.tool === 'pen' || newData.tool === 'eraser') {
        // If it's the same drawing session, prefer newer points
        if (newElement.userId === existingElement.userId) {
          return newElement.timestamp > existingElement.timestamp;
        }
        // Different users: use positional tiebreaker to avoid visual conflicts
        const newPath = newData.path || newData.points || [];
        const existingPath = existingData.path || existingData.points || [];
        const newPos = newPath[0] || { x: 0, y: 0 };
        const existingPos = existingPath[0] || { x: 0, y: 0 };
        
        if (Math.abs(newPos.x - existingPos.x) < 10 && Math.abs(newPos.y - existingPos.y) < 10) {
          // Very close positions - use timestamp
          return newElement.timestamp > existingElement.timestamp;
        }
        // Different positions - allow both
        return true;
      }
    }
    
    // For shapes and text, prefer completion over partial updates
    if (newElement.type === 'drawing') {
      const newData = newElement.data as DrawingElementData;
      if (newData.tool !== 'pen' && newData.tool !== 'eraser') {
        // If one element is complete and the other isn't, prefer complete
        const newComplete = this.isElementComplete(newElement);
        const existingComplete = this.isElementComplete(existingElement);
        
        if (newComplete && !existingComplete) return true;
        if (!newComplete && existingComplete) return false;
      }
    }
    
    // Default: use userId as deterministic tiebreaker
    return newElement.userId > existingElement.userId;
  }
  
  private isElementComplete(element: WhiteboardElement): boolean {
    // Determine if an element is in a complete state
    switch (element.type) {
      case 'drawing': {
        const data = element.data as DrawingElementData;
        switch (data.tool) {
          case 'pen':
          case 'eraser':
            const path = data.path || data.points || [];
            return path.length > 2; // At least 3 points for a meaningful stroke
          case 'rectangle':
          case 'circle':
            return data.startX !== undefined && data.startY !== undefined &&
                   data.endX !== undefined && data.endY !== undefined &&
                   Math.abs((data.endX || 0) - (data.startX || 0)) > 5 &&
                   Math.abs((data.endY || 0) - (data.startY || 0)) > 5;
          case 'line':
            return data.startX !== undefined && data.startY !== undefined &&
                   data.endX !== undefined && data.endY !== undefined;
          default:
            return true;
        }
      }
      case 'markdown': {
        const data = element.data as MarkdownElementData;
        return data.content !== undefined && data.content.trim() !== '';
      }
      default:
        return true;
    }
  }

  private updateVectorClock(userId: string): void {
    const currentValue = this.vector.get(userId) || 0;
    this.vector.set(userId, currentValue + 1);
  }

  deleteElement(elementId: string): void {
    this.elements.delete(elementId);
  }

  getState(): Map<string, WhiteboardElement> {
    return new Map(this.elements);
  }

  getElements(): Map<string, WhiteboardElement> {
    // Return a copy to prevent external modifications
    return new Map(this.elements);
  }

  getAllElements(): WhiteboardElement[] {
    return Array.from(this.elements.values()).filter(el => !el.deleted);
  }

  merge(remoteElements: WhiteboardElement[]): void {
    remoteElements.forEach(element => {
      this.applyOperation(element);
    });
  }

  clear(): void {
    this.elements.clear();
    this.vector.clear();
    this.vector.set(this.userId, 0);
  }

  getVectorClock(): Map<string, number> {
    return new Map(this.vector);
  }

  setVectorClock(vector: Map<string, number>): void {
    this.vector = new Map(vector);
  }
}