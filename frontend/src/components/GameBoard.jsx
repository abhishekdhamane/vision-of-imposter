import React, { useState, useEffect } from 'react';
import Canvas from './Canvas';
import Chat from './Chat';
import VotingScreen from './VotingScreen';

const GameBoard = ({
  roomCode,
  playerName,
  playerRole,
  wordToDisplay,
  gamePhase,
  onAction,
  players,
  currentRound,
  totalRounds,
  chatDuration,
  isHost,
  sharedDrawingData = '[]',
  isYourTurn = false,
  currentDrawerName = '',
  roundProgress = '0/0',
}) => {
  const [showPlayers, setShowPlayers] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-4">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="glass-effect p-4 rounded-lg mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white">Vision of Imposter</h1>
              <p className="text-gray-200">Room: {roomCode}</p>
            </div>
            <div className="text-right">
              <p className="text-white">You: <span className="font-bold">{playerName}</span></p>
              <p className={`font-bold ${playerRole === 'imposter' ? 'text-red-400' : 'text-green-400'}`}>
                Role: {playerRole?.toUpperCase()}
              </p>
            </div>
          </div>
        </div>

        {/* Players Panel */}
        <button
          onClick={() => setShowPlayers(!showPlayers)}
          className="mb-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          Players ({players?.length || 0}) {showPlayers ? '▼' : '▶'}
        </button>

        {(showPlayers || gamePhase === 'setup') && (
          <div className="glass-effect p-4 rounded-lg mb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {players && players.length > 0 ? (
                players.map((player) => (
                  <div key={player.id} className="bg-white/10 p-3 rounded text-center border border-white/20">
                    <p className="text-white font-bold text-sm">{player.name}</p>
                    {player.is_host && <p className="text-yellow-300 text-xs">👑 Host</p>}
                  </div>
                ))
              ) : (
                <p className="text-gray-400 col-span-2">Waiting for players...</p>
              )}
            </div>
          </div>
        )}

        {/* Game Content */}
        <div className="glass-effect p-6 rounded-xl">
          {gamePhase === 'drawing' && (
            <div>
              <div className="mb-4 text-center">
                <p className="text-gray-200 text-sm">Drawing Progress</p>
                <p className="text-white font-bold">{roundProgress}</p>
              </div>
              <Canvas
                wordToDisplay={wordToDisplay}
                drawingData={sharedDrawingData || '[]'}
                isYourTurn={isYourTurn}
                currentDrawerName={currentDrawerName}
                onSubmit={(lineData) => onAction({
                  type: 'submit_drawing',
                  line_data: lineData,
                })}
              />
            </div>
          )}

          {gamePhase === 'chat' && (
            <Chat
              roundNumber={currentRound}
              totalRounds={totalRounds}
              duration={chatDuration}
              playersInfo={players}
              onEndChat={() => onAction({ type: 'end_chat' })}
            />
          )}

          {gamePhase === 'voting' && (
            <VotingScreen
              players={players}
              currentRound={currentRound}
              totalRounds={totalRounds}
              onVote={(playerId) => onAction({
                type: 'submit_vote',
                vote_for: playerId,
              })}
            />
          )}

          {gamePhase === 'setup' && (
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white mb-4">Room Setup</h2>
              <div className="bg-green-600/30 border-2 border-green-400 rounded-lg p-6 mb-6">
                <p className="text-gray-200 text-sm mb-2">Room Code:</p>
                <p className="text-4xl font-bold text-green-300 tracking-widest mb-4">{roomCode}</p>
                <p className="text-gray-300 text-sm">Share this code with other players</p>
              </div>
              
              <div className="mb-6">
                <p className="text-xl text-white font-bold">Players Ready: {players?.length || 0}</p>
              </div>
              
              {isHost ? (
                <div>
                  <p className="text-green-300 font-bold mb-4">✓ You are the Host</p>
                  <button
                    onClick={() => onAction({ type: 'start_game' })}
                    disabled={players?.length < 2}
                    className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-500 font-bold text-lg"
                  >
                    {players?.length < 2 ? 'Waiting for players...' : 'Start Game'}
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-yellow-300 font-bold">⏳ Waiting for host to start...</p>
                </div>
              )}
            </div>
          )}

          {gamePhase === 'results' && (
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white mb-4">Round Results</h2>
              <p className="text-xl text-gray-200 mb-6">Waiting for next round...</p>
              {isHost && (
                <button
                  onClick={() => onAction({ type: 'next_round' })}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-lg"
                >
                  Next Round
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameBoard;
