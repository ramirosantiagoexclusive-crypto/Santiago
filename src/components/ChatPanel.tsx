import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../game/WebSocketMultiplayer';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  myId: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onSend, myId }) => {
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (input.trim()) {
      onSend(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
    e.stopPropagation(); // Предотвращаем обработку клавиш игрой
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 z-20 bg-gray-800/80 hover:bg-gray-700 text-white px-3 py-2 rounded-lg backdrop-blur-sm border border-gray-600/50 text-sm"
      >
        💬 Чат {messages.length > 0 && (
          <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5">
            {messages.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-20 w-72 bg-gray-800/95 backdrop-blur-sm rounded-lg border border-gray-600/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-700/50 border-b border-gray-600/50">
        <span className="text-white text-sm font-bold">💬 Чат</span>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="h-48 overflow-y-auto p-2 space-y-1">
        {messages.length === 0 ? (
          <p className="text-gray-500 text-xs text-center py-4">
            Сообщений пока нет
          </p>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`text-xs ${msg.from === myId ? 'text-right' : ''}`}>
              <span className={`font-bold ${msg.from === myId ? 'text-blue-400' : 'text-green-400'}`}>
                {msg.fromName}:
              </span>{' '}
              <span className="text-gray-200">{msg.text}</span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-1 p-2 border-t border-gray-600/50">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={(e) => e.stopPropagation()}
          placeholder="Сообщение..."
          maxLength={200}
          className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white text-xs rounded font-bold"
        >
          →
        </button>
      </div>
    </div>
  );
};
