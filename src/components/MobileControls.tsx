import React from 'react';

interface MobileControlsProps {
  onJump: () => void;
  onRun: (running: boolean) => void;
  isRunning: boolean;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  onJump,
  onRun,
  isRunning,
}) => {
  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-3 z-20 md:hidden">
      {/* Кнопка бега */}
      <button
        onTouchStart={(e) => {
          e.preventDefault();
          onRun(true);
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          onRun(false);
        }}
        className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold transition-all ${
          isRunning
            ? 'bg-yellow-500 text-white scale-110 shadow-lg shadow-yellow-500/50'
            : 'bg-gray-700/80 text-gray-300 backdrop-blur-sm border border-gray-600/50'
        }`}
      >
        🏃
      </button>

      {/* Кнопка прыжка */}
      <button
        onTouchStart={(e) => {
          e.preventDefault();
          onJump();
        }}
        className="w-20 h-20 rounded-full bg-blue-600/80 text-white text-3xl flex items-center justify-center backdrop-blur-sm border border-blue-400/50 active:scale-95 active:bg-blue-500 transition-all shadow-lg shadow-blue-600/30"
      >
        ⬆️
      </button>
    </div>
  );
};
