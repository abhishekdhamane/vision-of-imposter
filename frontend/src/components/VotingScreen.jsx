import React, { useState } from 'react';

const VotingScreen = ({ players, onVote, currentRound, totalRounds }) => {
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const handleVote = () => {
    if (selectedPlayer) {
      onVote(selectedPlayer);
      setSelectedPlayer(null);
    }
  };

  return (
    <div className="flex flex-col gap-4 max-w-4xl mx-auto">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Voting Time!</h2>
        <p className="text-gray-200">
          Round {currentRound} of {totalRounds} - Vote for the imposter
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {players.map((player) => (
          <button
            key={player.id}
            onClick={() => setSelectedPlayer(player.id)}
            className={`p-4 rounded-lg font-bold text-lg transition-all ${
              selectedPlayer === player.id
                ? 'bg-red-500 text-white scale-105'
                : 'glass-effect text-white hover:bg-red-400'
            }`}
          >
            <div className="text-center">
              <p className="text-2xl mb-2">👤</p>
              <p>{player.name}</p>
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={handleVote}
        disabled={!selectedPlayer}
        className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-500 font-bold text-lg"
      >
        Confirm Vote
      </button>
    </div>
  );
};

export default VotingScreen;
