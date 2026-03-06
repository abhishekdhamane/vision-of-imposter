/**
 * VotingScreen.jsx — Player-selection voting UI.
 * Players may vote for any player, including themselves.
 */
import React, { useState } from 'react';

const VotingScreen = ({ players, playerId, onVote }) => {
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const handleVote = () => {
    if (!selected) return;
    onVote(selected);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="text-center py-12">
        <h2 className="text-3xl font-bold text-white mb-4">Vote Submitted!</h2>
        <p className="text-gray-200 text-lg">Waiting for other players…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-4xl mx-auto">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Voting Time!</h2>
        <p className="text-gray-200">Who is the imposter?</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {players.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={`p-4 rounded-lg font-bold text-lg transition-all ${
                selected === p.id
                  ? 'bg-red-500 text-white scale-105'
                  : 'glass-effect text-white hover:bg-red-400/40'
              }`}
            >
              <div className="text-center">
                <p className="text-2xl mb-2">👤</p>
                <p>{p.name}{p.id === playerId ? ' (You)' : ''}</p>
              </div>
            </button>
          ))}
      </div>

      <button
        onClick={handleVote}
        disabled={!selected}
        className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-500 font-bold text-lg"
      >
        Confirm Vote
      </button>
    </div>
  );
};

export default VotingScreen;
