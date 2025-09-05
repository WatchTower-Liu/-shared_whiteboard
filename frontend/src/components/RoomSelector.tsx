import React, { useState } from 'react';
import './RoomSelector.css';

interface RoomSelectorProps {
  onRoomJoin: (roomId: string) => void;
}

const RoomSelector: React.FC<RoomSelectorProps> = ({ onRoomJoin }) => {
  const [roomId, setRoomId] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  const handleJoinRoom = async () => {
    if (!roomId.trim()) {
      alert('请输入房间号');
      return;
    }

    setIsChecking(true);
    try {
      // Check if room exists
      const response = await fetch(`/api/rooms/${roomId}/exists`);
      const data = await response.json();
      console.log(data);
      if (data.exists) {
        // Room exists, join directly
        onRoomJoin(roomId);
      } else {
        // Room doesn't exist, ask user if they want to create it
        const shouldCreate = window.confirm(`房间 "${roomId}" 不存在。是否创建新房间？`);
        
        if (shouldCreate) {
          // Create the room
          const createResponse = await fetch(`/api/rooms/${roomId}`, {
            method: 'POST',
          });
          const createData = await createResponse.json();
          
          if (createData.success) {
            onRoomJoin(roomId);
          } else {
            alert('创建房间失败，请重试');
          }
        }
      }
    } catch (error) {
      console.error('Error checking/creating room:', error);
      alert('连接服务器失败，请检查网络连接');
    } finally {
      setIsChecking(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleJoinRoom();
    }
  };

  return (
    <div className="room-selector-overlay">
      <div className="room-selector-modal">
        <h2>加入白板房间</h2>
        <div className="room-selector-content">
          <input
            type="text"
            placeholder="输入房间号"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isChecking}
            autoFocus
          />
          <button 
            onClick={handleJoinRoom}
            disabled={isChecking || !roomId.trim()}
          >
            {isChecking ? '连接中...' : '加入房间'}
          </button>
        </div>
        <p className="room-selector-hint">
          输入已存在的房间号加入，或输入新的房间号创建
        </p>
      </div>
    </div>
  );
};

export default RoomSelector;