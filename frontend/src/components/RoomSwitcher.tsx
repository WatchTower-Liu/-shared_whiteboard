import React, { useState } from 'react';
import './RoomSwitcher.css';

interface RoomSwitcherProps {
  currentRoomId: string;
  onRoomChange: (newRoomId: string) => void;
}

const RoomSwitcher: React.FC<RoomSwitcherProps> = ({ currentRoomId, onRoomChange }) => {
  const [newRoomId, setNewRoomId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const handleSwitchRoom = async () => {
    if (!newRoomId.trim()) {
      alert('请输入房间号');
      return;
    }

    if (newRoomId.trim() === currentRoomId) {
      alert('已经在此房间中');
      setIsModalOpen(false);
      return;
    }

    setIsChecking(true);
    try {
      // Check if room exists
      const response = await fetch(`/api/rooms/${newRoomId}/exists`);
      const data = await response.json();
      
      if (data.exists) {
        // Room exists, switch directly
        onRoomChange(newRoomId);
        setIsModalOpen(false);
        setNewRoomId('');
      } else {
        // Room doesn't exist, ask user if they want to create it
        const shouldCreate = window.confirm(`房间 "${newRoomId}" 不存在。是否创建新房间？`);
        
        if (shouldCreate) {
          // Create the room
          const createResponse = await fetch(`/api/rooms/${newRoomId}`, {
            method: 'POST',
          });
          const createData = await createResponse.json();
          
          if (createData.success) {
            onRoomChange(newRoomId);
            setIsModalOpen(false);
            setNewRoomId('');
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
      handleSwitchRoom();
    } else if (e.key === 'Escape') {
      setIsModalOpen(false);
    }
  };

  const handleModalOpen = () => {
    setIsModalOpen(true);
    setNewRoomId('');
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setNewRoomId('');
  };

  return (
    <>
      <div className="room-switcher">
        <div className="room-info-display">
          <span className="room-label">房间:</span>
          <span className="room-id">{currentRoomId}</span>
          <button 
            className="switch-room-btn"
            onClick={handleModalOpen}
            title="切换房间"
          >
            切换
          </button>
        </div>
      </div>

      {isModalOpen && (
        <div className="room-switcher-overlay" onClick={handleModalClose}>
          <div className="room-switcher-modal" onClick={(e) => e.stopPropagation()}>
            <div className="room-switcher-header">
              <h3>切换房间</h3>
              <button 
                className="close-btn"
                onClick={handleModalClose}
              >
                ×
              </button>
            </div>
            <div className="room-switcher-content">
              <div className="current-room">
                <span>当前房间: <strong>{currentRoomId}</strong></span>
              </div>
              <input
                type="text"
                placeholder="输入新的房间号"
                value={newRoomId}
                onChange={(e) => setNewRoomId(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isChecking}
                autoFocus
              />
              <div className="room-switcher-actions">
                <button 
                  className="cancel-btn"
                  onClick={handleModalClose}
                  disabled={isChecking}
                >
                  取消
                </button>
                <button 
                  className="switch-btn"
                  onClick={handleSwitchRoom}
                  disabled={isChecking || !newRoomId.trim()}
                >
                  {isChecking ? '切换中...' : '切换房间'}
                </button>
              </div>
            </div>
            <p className="room-switcher-hint">
              输入已存在的房间号加入，或输入新的房间号创建
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default RoomSwitcher;