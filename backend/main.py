from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import Dict, Set
import json
import asyncio
from datetime import datetime
import uuid
import os
from pathlib import Path

app = FastAPI()

# Enable CORS for frontend
# In production, replace ["*"] with your actual frontend domains for better security
allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",") if os.getenv("ALLOWED_ORIGINS") != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.whiteboard_state: Dict[str, Dict[str, dict]] = {}  # room_id -> element_id -> element
        self.cursors: Dict[str, dict] = {}
        self.user_rooms: Dict[str, str] = {}  # client_id -> room_id
        self.data_dir = Path("./whiteboard_data")
        self.data_dir.mkdir(exist_ok=True)
    
    def _get_room_file(self, room_id: str) -> Path:
        """Get the file path for a room's data"""
        return self.data_dir / f"room_{room_id}.json"
    
    def _load_room_data(self, room_id: str) -> dict:
        """Load room data from file"""
        room_file = self._get_room_file(room_id)
        if room_file.exists():
            try:
                with open(room_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return data.get('whiteboard_state', {})
            except Exception as e:
                print(f"Error loading room {room_id} data: {e}")
        return {}
    
    def _save_room_data(self, room_id: str):
        """Save room data to file"""
        room_file = self._get_room_file(room_id)
        try:
            room_state = self.whiteboard_state.get(room_id, {})
            
            data = {
                'room_id': room_id,
                'whiteboard_state': room_state,
                'last_updated': datetime.now().isoformat()
            }
            
            with open(room_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Error saving room {room_id} data: {e}")
    
    async def connect(self, websocket: WebSocket, client_id: str, room_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.user_rooms[client_id] = room_id
        
        # Initialize room if needed
        if room_id not in self.whiteboard_state:
            self.whiteboard_state[room_id] = self._load_room_data(room_id)
        
        # Send current state to new client
        await websocket.send_json({
            "type": "sync",
            "data": {
                "state": self.whiteboard_state.get(room_id, {}),
                "cursors": {k: v for k, v in self.cursors.items() 
                          if self.user_rooms.get(k) == room_id}
            }
        })
        
        # Notify others in the same room of new connection
        await self.broadcast_to_room({
            "type": "user_joined",
            "clientId": client_id
        }, room_id, client_id)
    
    def disconnect(self, client_id: str):
        room_id = self.user_rooms.get(client_id)
        
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.cursors:
            del self.cursors[client_id]
        if client_id in self.user_rooms:
            del self.user_rooms[client_id]
        
        # Save room data when a user disconnects
        if room_id:
            self._save_room_data(room_id)
            
            # Notify others in the same room of disconnection
            asyncio.create_task(self.broadcast_to_room({
                "type": "user_left",
                "clientId": client_id
            }, room_id, client_id))
    
    async def broadcast(self, message: dict):
        for connection in self.active_connections.values():
            try:
                await connection.send_json(message)
            except:
                pass
    
    async def broadcast_to_room(self, message: dict, room_id: str, sender_id: str = None):
        """Broadcast message to all clients in a specific room except sender"""
        for client_id, connection in self.active_connections.items():
            if self.user_rooms.get(client_id) == room_id and client_id != sender_id:
                try:
                    await connection.send_json(message)
                except:
                    pass
    
    async def handle_operation(self, operation: dict, sender_id: str):
        room_id = self.user_rooms.get(sender_id)
        if not room_id:
            return
            
        element_id = operation.get("id")
        if element_id:
            # Initialize room state if needed
            if room_id not in self.whiteboard_state:
                self.whiteboard_state[room_id] = {}
            
            # Apply CRDT Last-Write-Wins logic with improved conflict resolution
            room_state = self.whiteboard_state[room_id]
            existing_element = room_state.get(element_id)
            
            # If element doesn't exist or new operation has newer timestamp
            if not existing_element or \
               operation.get("timestamp", 0) > existing_element.get("timestamp", 0):
                room_state[element_id] = operation
                # Auto-save after each operation
                self._save_room_data(room_id)
                
                # Broadcast to all clients in the same room except sender
                await self.broadcast_to_room({
                    "type": "operation",
                    "data": operation,
                    "senderId": sender_id
                }, room_id, sender_id)
    
    async def handle_batch_operations(self, batch_data: dict, sender_id: str):
        """Handle multiple operations as a batch"""
        room_id = self.user_rooms.get(sender_id)
        if not room_id:
            return
            
        operations = batch_data.get("operations", [])
        if not operations:
            return
        
        # Initialize room state if needed
        if room_id not in self.whiteboard_state:
            self.whiteboard_state[room_id] = {}
        
        room_state = self.whiteboard_state[room_id]
        updated_elements = []
        
        # Process all operations in the batch
        for operation in operations:
            element_id = operation.get("id")
            if element_id:
                existing_element = room_state.get(element_id)
                
                # Apply CRDT Last-Write-Wins logic
                if not existing_element or \
                   operation.get("timestamp", 0) > existing_element.get("timestamp", 0):
                    room_state[element_id] = operation
                    updated_elements.append(operation)
        
        # Save once after processing all operations
        if updated_elements:
            self._save_room_data(room_id)
            
            # Broadcast batch update to all clients in the same room except sender
            await self.broadcast_to_room({
                "type": "batch_operations",
                "data": {
                    "operations": updated_elements,
                    "senderId": sender_id
                }
            }, room_id, sender_id)
    
    async def handle_cursor(self, cursor_data: dict, sender_id: str):
        room_id = self.user_rooms.get(sender_id)
        if not room_id:
            return
            
        self.cursors[sender_id] = cursor_data
        
        await self.broadcast_to_room({
            "type": "cursor",
            "clientId": sender_id,
            "data": cursor_data
        }, room_id, sender_id)
    
    async def handle_delete(self, element_id: str, sender_id: str):
        room_id = self.user_rooms.get(sender_id)
        if not room_id:
            return
            
        if room_id in self.whiteboard_state and element_id in self.whiteboard_state[room_id]:
            del self.whiteboard_state[room_id][element_id]
            # Auto-save after deletion
            self._save_room_data(room_id)
        
        await self.broadcast_to_room({
            "type": "delete",
            "elementId": element_id,
            "senderId": sender_id
        }, room_id, sender_id)

manager = ConnectionManager()

@app.websocket("/ws/{room_id}/{client_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, client_id: str):
    await manager.connect(websocket, client_id, room_id)
    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")
            
            if message_type == "operation":
                await manager.handle_operation(data.get("data", {}), client_id)
            elif message_type == "batch_operations":
                await manager.handle_batch_operations(data.get("data", {}), client_id)
            elif message_type == "cursor":
                await manager.handle_cursor(data.get("data", {}), client_id)
            elif message_type == "delete":
                await manager.handle_delete(data.get("elementId"), client_id)
            elif message_type == "sync_request":
                room_state = manager.whiteboard_state.get(room_id, {})
                room_cursors = {k: v for k, v in manager.cursors.items() 
                              if manager.user_rooms.get(k) == room_id}
                await websocket.send_json({
                    "type": "sync",
                    "data": {
                        "state": room_state,
                        "cursors": room_cursors
                    }
                })
            elif message_type == "ping":
                # Respond to heartbeat
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as e:
        print(f"Error handling client {client_id}: {e}")
        manager.disconnect(client_id)

# Mount static files from frontend dist folder (after build)
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")
    
    # Serve the main index.html for the root path
    @app.get("/")
    async def serve_frontend():
        index_file = frontend_dist / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        else:
            return {"message": "Frontend not built. Please run 'npm run build' in the frontend directory."}
else:
    @app.get("/")
    async def serve_info():
        return {
            "message": "Whiteboard WebSocket Server",
            "status": "running",
            "note": "Frontend not built. Please run 'npm run build' in the frontend directory."
        }

# API info endpoint
@app.get("/api")
async def root():
    return {"message": "Whiteboard WebSocket Server", "status": "running"}

# Check if room exists
@app.get("/api/rooms/{room_id}/exists")
async def check_room_exists(room_id: str):
    room_file = manager._get_room_file(room_id)
    exists = room_file.exists()
    return {"exists": exists, "room_id": room_id}

# Create a new room
@app.post("/api/rooms/{room_id}")
async def create_room(room_id: str):
    room_file = manager._get_room_file(room_id)
    if not room_file.exists():
        manager.whiteboard_state[room_id] = {}
        manager._save_room_data(room_id)
        return {"success": True, "room_id": room_id, "message": "Room created"}
    return {"success": False, "room_id": room_id, "message": "Room already exists"}

if __name__ == "__main__":
    import uvicorn
    # Get host and port from environment variables for production deployment
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    
    # Enable SSL in production if certificates are provided
    ssl_keyfile = os.getenv("SSL_KEYFILE")
    ssl_certfile = os.getenv("SSL_CERTFILE")
    
    if ssl_keyfile and ssl_certfile:
        uvicorn.run(app, host=host, port=port, ssl_keyfile=ssl_keyfile, ssl_certfile=ssl_certfile)
    else:
        uvicorn.run(app, host=host, port=port)
