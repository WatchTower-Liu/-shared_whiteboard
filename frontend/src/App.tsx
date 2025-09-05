import { useState, useEffect } from 'react';
import Whiteboard from './components/Whiteboard';
import RoomSelector from './components/RoomSelector';
import RoomSwitcher from './components/RoomSwitcher';
import './App.css';

function App() {
  const [roomId, setRoomId] = useState<string | null>(() => {
    // Get room ID from URL
    const params = new URLSearchParams(window.location.search);
    return params.get('room');
  });
  
  const [userId] = useState(() => {
    // Generate or retrieve user ID
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) {
      return storedUserId;
    }
    const newUserId = `user-${Math.random().toString(36).substring(7)}`;
    localStorage.setItem('userId', newUserId);
    return newUserId;
  });

  const handleRoomJoin = (newRoomId: string) => {
    setRoomId(newRoomId);
    // Update URL with room ID
    const params = new URLSearchParams(window.location.search);
    params.set('room', newRoomId);
    window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
  };

  const handleRoomChange = (newRoomId: string) => {
    setRoomId(newRoomId);
    // Update URL with room ID
    const params = new URLSearchParams(window.location.search);
    params.set('room', newRoomId);
    window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
  };

  useEffect(() => {
    // If room ID is in URL but not in state, set it
    const params = new URLSearchParams(window.location.search);
    const urlRoomId = params.get('room');
    if (urlRoomId && !roomId) {
      setRoomId(urlRoomId);
    }
  }, []);

  return (
    <div className="app">
      {!roomId ? (
        <RoomSelector onRoomJoin={handleRoomJoin} />
      ) : (
        <>
          <RoomSwitcher 
            currentRoomId={roomId} 
            onRoomChange={handleRoomChange}
          />
          <Whiteboard 
            roomId={roomId} 
            userId={userId} 
            key={roomId} // Force re-render when room changes
          />
        </>
      )}
    </div>
  );
}

export default App;
