import React from 'react';

interface ServerStatusProps {
  connected: boolean;
  connecting: boolean;
  status: string;
  playersCount: number;
  myName: string;
  onNameChange: (name: string) => void;
}

export const ServerStatus: React.FC<ServerStatusProps> = ({
  connected,
  connecting,
  status,
  playersCount,
  myName,
  onNameChange,
}) => {
  return (
    <div className="fixed top-4 right-4 z-30 bg-gray-800/90 backdrop-blur-sm rounded-lg p-3 border border-gray-600/50 max-w-[250px]">
      {/* Статус подключения */}
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2 h-2 rounded-full ${
          connected ? 'bg-green-500 animate-pulse' : 
          connecting ? 'bg-yellow-500 animate-pulse' : 
          'bg-red-500'
        }`}></div>
        <span className={`text-sm font-bold ${
          connected ? 'text-green-400' : 
          connecting ? 'text-yellow-400' : 
          'text-red-400'
        }`}>
          {connected ? 'Онлайн' : connecting ? 'Подключение...' : 'Оффлайн'}
        </span>
      </div>

      {/* Имя игрока */}
      <div className="mb-2">
        <label className="text-xs text-gray-400 block mb-1">Ваше имя:</label>
        <input
          type="text"
          value={myName}
          onChange={(e) => onNameChange(e.target.value)}
          maxLength={20}
          className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs focus:outline-none focus:border-purple-500"
          placeholder="Введите имя..."
        />
      </div>

      {/* Статистика */}
      <div className="text-xs text-gray-300 space-y-1">
        <div className="flex justify-between">
          <span>Игроков онлайн:</span>
          <span className="font-bold text-blue-400">{playersCount}</span>
        </div>
        <div className="text-[10px] text-gray-500 mt-1">
          {status}
        </div>
      </div>
    </div>
  );
};
