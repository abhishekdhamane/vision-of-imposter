import React, { useState, useEffect, useRef } from 'react';

const Chat = ({ roundNumber, totalRounds, duration = 120, onEndChat, onSendMessage, chatMessages = [], playersInfo = [], isHost = false }) => {
  const [input, setInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(duration);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (isHost) onEndChat();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onEndChat, isHost]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const minutesLeft = Math.floor(timeLeft / 60);
  const secondsLeft = timeLeft % 60;

  return (
    <div className="flex flex-col gap-4 h-full max-w-2xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Discussion Phase</h2>
        <p className="text-red-300 font-bold text-lg">
          Time left: {minutesLeft}:{secondsLeft.toString().padStart(2, '0')}
        </p>
      </div>

      <div className="glass-effect p-4 flex-1 overflow-y-auto rounded-lg">
        <div className="space-y-3">
          {chatMessages.length === 0 ? (
            <p className="text-gray-400 text-center">Waiting for messages...</p>
          ) : (
            chatMessages.map((msg, idx) => (
              <div key={idx} className="bg-white/10 p-3 rounded">
                <div className="flex justify-between">
                  <span className="font-bold text-yellow-300">{msg.player_name}</span>
                  <span className="text-xs text-gray-300">{msg.timestamp}</span>
                </div>
                <p className="text-white mt-1">{msg.message}</p>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <form onSubmit={handleSendMessage} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Accuse or discuss..."
          className="flex-1 px-4 py-2 rounded-lg focus:outline-none"
        />
        <button
          type="submit"
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-bold"
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default Chat;
