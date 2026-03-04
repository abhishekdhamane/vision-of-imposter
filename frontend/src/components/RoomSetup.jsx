import React, { useState } from 'react';

const RoomSetup = ({ onCreateRoom, onJoinRoom }) => {
  const [mode, setMode] = useState(null); // 'create' or 'join'
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [imposterCount, setImposterCount] = useState(1);
  const [totalRounds, setTotalRounds] = useState(3);
  const [chatDuration, setChatDuration] = useState(120);

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (playerName.trim()) {
      onCreateRoom({
        playerName,
        imposterCount,
        totalRounds,
        chatDuration,
      });
    }
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (playerName.trim() && roomCode.trim()) {
      onJoinRoom({
        playerName,
        roomCode,
      });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="glass-effect p-8 rounded-xl max-w-md w-full">
        <h1 className="text-4xl font-bold text-white text-center mb-8">
          Vision of Imposter
        </h1>

        {mode === null && (
          <div className="flex gap-4">
            <button
              onClick={() => setMode('create')}
              className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold text-lg"
            >
              Create Room
            </button>
            <button
              onClick={() => setMode('join')}
              className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold text-lg"
            >
              Join Room
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreateRoom} className="space-y-4">
            <div>
              <label className="block text-white mb-2">Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-2 rounded-lg focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-white mb-2">
                Number of Imposters: {imposterCount}
              </label>
              <input
                type="range"
                min="1"
                max="5"
                value={imposterCount}
                onChange={(e) => setImposterCount(parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-white mb-2">
                Rounds Before Voting: {totalRounds}
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={totalRounds}
                onChange={(e) => setTotalRounds(parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-white mb-2">
                Chat Duration: {chatDuration} seconds
              </label>
              <input
                type="range"
                min="30"
                max="300"
                step="30"
                value={chatDuration}
                onChange={(e) => setChatDuration(parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            <button
              type="submit"
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold"
            >
              Create & Start
            </button>

            <button
              type="button"
              onClick={() => setMode(null)}
              className="w-full px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Back
            </button>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoinRoom} className="space-y-4">
            <div>
              <label className="block text-white mb-2">Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-2 rounded-lg focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-white mb-2">Room Code</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Enter 6-digit code"
                maxLength={6}
                className="w-full px-4 py-2 rounded-lg focus:outline-none text-center text-2xl tracking-widest"
              />
            </div>

            <button
              type="submit"
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold"
            >
              Join Game
            </button>

            <button
              type="button"
              onClick={() => setMode(null)}
              className="w-full px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default RoomSetup;
