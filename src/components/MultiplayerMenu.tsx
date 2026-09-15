import React, { useState } from 'react';

interface MultiplayerMenuProps {
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onDisconnect: () => void;
  roomCode: string;
  isConnected: boolean;
  status: string;
  playerName: string;
  onNameChange: (name: string) => void;
}

export const MultiplayerMenu: React.FC<MultiplayerMenuProps> = ({
  onCreateRoom,
  onJoinRoom,
  onDisconnect,
  roomCode,
  isConnected,
  status,
  playerName,
  onNameChange,
}) => {
  const [joinCode, setJoinCode] = useState('');
  const [showMenu, setShowMenu] = useState(false);

  if (isConnected) {
    return (
      <div className="fixed top-4 right-4 z-30 bg-gray-800/90 backdrop-blur-sm rounded-lg p-3 border border-green-500/50 max-w-[250px]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-green-400 text-sm font-bold">● Онлайн</span>
          <button
            onClick={onDisconnect}
            className="text-red-400 text-xs hover:text-red-300"
          >
            Выйти
          </button>
        </div>
        <div className="text-xs text-gray-300">
          <p>Имя: {playerName}</p>
          <p className="truncate">Код: {roomCode.substring(0, 12)}...</p>
        </div>
        {status && (
          <p className="text-xs text-yellow-400 mt-1">{status}</p>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Кнопка открытия меню */}
      <button
        onClick={() => setShowMenu(true)}
        className="fixed top-4 right-4 z-30 bg-purple-600/80 hover:bg-purple-500 text-white px-4 py-2 rounded-lg backdrop-blur-sm border border-purple-400/50 transition-all text-sm font-bold"
      >
        🎮 Мультиплеер
      </button>

      {/* Модальное окно */}
      {showMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-gray-600">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">🎮 Мультиплеер</h2>
              <button
                onClick={() => setShowMenu(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            {/* Имя игрока */}
            <div className="mb-4">
              <label className="text-sm text-gray-300 block mb-1">Ваше имя</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => onNameChange(e.target.value)}
                maxLength={20}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                placeholder="Введите имя..."
              />
            </div>

            {/* Создать комнату */}
            <div className="mb-4">
              <button
                onClick={() => {
                  onCreateRoom();
                  setShowMenu(false);
                }}
                className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold transition-all"
              >
                🏠 Создать комнату
              </button>
            </div>

            {/* Присоединиться */}
            <div className="mb-4">
              <label className="text-sm text-gray-300 block mb-1">Код комнаты</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  placeholder="Вставьте код..."
                />
                <button
                  onClick={() => {
                    if (joinCode.trim()) {
                      onJoinRoom(joinCode.trim());
                      setShowMenu(false);
                    }
                  }}
                  disabled={!joinCode.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-all"
                >
                  Войти
                </button>
              </div>
            </div>

            {/* Статус */}
            {status && (
              <div className="p-3 bg-gray-700/50 rounded-lg">
                <p className="text-sm text-yellow-400">{status}</p>
              </div>
            )}

            {/* Информация */}
            <div className="mt-4 p-3 bg-blue-900/30 rounded-lg border border-blue-700/50">
              <p className="text-xs text-blue-300">
                💡 <strong>Как играть:</strong>
              </p>
              <ul className="text-xs text-gray-300 mt-1 space-y-1">
                <li>• Создайте комнату и поделитесь кодом с друзьями</li>
                <li>• Друзья вставляют код и подключаются</li>
                <li>• Игра работает через P2P соединение</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
