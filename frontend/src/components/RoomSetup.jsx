/**
 * RoomSetup.jsx — Create or join a game room.
 */
import React, { useState } from 'react';

const RoomSetup = ({ onCreateRoom, onJoinRoom }) => {
  const [mode, setMode] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [imposterCount, setImposterCount] = useState(1);
  const [totalRounds, setTotalRounds] = useState(3);
  const [chatDuration, setChatDuration] = useState(120);

  const handleCreate = (e) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    onCreateRoom({ playerName, imposterCount, totalRounds, chatDuration });
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!playerName.trim() || !roomCode.trim()) return;
    onJoinRoom({ playerName, roomCode });
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
          <form onSubmit={handleCreate} className="space-y-4">
            <Field label="Your Name">
              <input value={playerName} onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name" className="w-full px-4 py-2 rounded-lg focus:outline-none" />
            </Field>

            <Field label={`Number of Imposters: ${imposterCount}`}>
              <input type="range" min="1" max="5" value={imposterCount}
                onChange={(e) => setImposterCount(+e.target.value)} className="w-full" />
            </Field>

            <Field label={`Rounds Before Voting: ${totalRounds}`}>
              <input type="range" min="1" max="10" value={totalRounds}
                onChange={(e) => setTotalRounds(+e.target.value)} className="w-full" />
            </Field>

            <Field label={`Chat Duration: ${chatDuration}s`}>
              <input type="range" min="30" max="300" step="30" value={chatDuration}
                onChange={(e) => setChatDuration(+e.target.value)} className="w-full" />
            </Field>

            <button type="submit"
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold">
              Create &amp; Start
            </button>
            <button type="button" onClick={() => setMode(null)}
              className="w-full px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
              Back
            </button>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin} className="space-y-4">
            <Field label="Your Name">
              <input value={playerName} onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name" className="w-full px-4 py-2 rounded-lg focus:outline-none" />
            </Field>
            <Field label="Room Code">
              <input value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Enter 6-digit code" maxLength={6}
                className="w-full px-4 py-2 rounded-lg focus:outline-none text-center text-2xl tracking-widest" />
            </Field>
            <button type="submit"
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold">
              Join Game
            </button>
            <button type="button" onClick={() => setMode(null)}
              className="w-full px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

/** Re-usable form field wrapper */
const Field = ({ label, children }) => (
  <div>
    <label className="block text-white mb-2">{label}</label>
    {children}
  </div>
);

export default RoomSetup;
