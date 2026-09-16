import React, { useState } from 'react';

interface NameModalProps {
  onSubmit: (name: string) => void;
}

export const NameModal: React.FC<NameModalProps> = ({ onSubmit }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('Имя должно быть минимум 2 символа');
      return;
    }
    if (trimmed.length > 20) {
      setError('Имя должно быть максимум 20 символов');
      return;
    }
    
    onSubmit(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 border border-purple-500/50 shadow-2xl shadow-purple-500/20">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🎮</div>
          <h2 className="text-2xl font-bold text-white mb-2">Добро пожаловать!</h2>
          <p className="text-gray-400 text-sm">
            Введите имя чтобы присоединиться к игре
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="text-sm text-gray-300 block mb-2">Ваш никнейм</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              maxLength={20}
              autoFocus
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
              placeholder="Введите имя..."
            />
            {error && (
              <p className="text-red-400 text-sm mt-2">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={name.trim().length < 2}
            className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-bold text-lg transition-all transform hover:scale-105 active:scale-95"
          >
            🚀 Войти в игру
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-gray-500">
          Мультиплеер: все игроки в одном мире
        </div>
      </div>
    </div>
  );
};
