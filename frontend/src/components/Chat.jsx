/**
 * Chat.jsx — Discussion phase with countdown timer.
 */
import React, { useState, useEffect, useRef } from 'react';

const Chat = ({
  roundNumber,
  totalRounds,
  duration = 120,
  onEndChat,
  onSendMessage,
  chatMessages = [],
  isHost = false,
}) => {
  const [input, setInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(duration);
  const [timerDone, setTimerDone] = useState(false);
  const bottomRef = useRef(null);

  // Countdown
  useEffect(() => {
    if (timerDone) return;
    const id = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { setTimerDone(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerDone]);

  // Auto end-chat when timer is done (host triggers)
  useEffect(() => {
    if (timerDone && isHost) onEndChat();
  }, [timerDone, isHost, onEndChat]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (text) { onSendMessage(text); setInput(''); }
  };

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <div className="flex flex-col gap-4 h-full max-w-2xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-1">Discussion Phase</h2>
        <p className="text-gray-300 text-sm">
          Round {roundNumber} of {totalRounds}
        </p>
        <p className="text-red-300 font-bold text-lg">
          Time left: {mins}:{String(secs).padStart(2, '0')}
        </p>
      </div>

      <div className="glass-effect p-4 flex-1 overflow-y-auto rounded-lg max-h-80">
        <div className="space-y-3">
          {chatMessages.length === 0 ? (
            <p className="text-gray-400 text-center">Waiting for messages…</p>
          ) : (
            chatMessages.map((msg, i) => (
              <div key={i} className="bg-white/10 p-3 rounded">
                <div className="flex justify-between">
                  <span className="font-bold text-yellow-300">{msg.player_name}</span>
                  <span className="text-xs text-gray-300">{msg.timestamp}</span>
                </div>
                <p className="text-white mt-1">{msg.message}</p>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Accuse or discuss…"
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
