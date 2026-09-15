import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine, GameState } from './game/GameEngine';
import type { Emotion } from './game/SpriteGenerator';

// Эмодзи для кнопок эмоций
const EMOTION_ICONS: { emotion: Emotion; icon: string; label: string; key: string }[] = [
  { emotion: 'happy', icon: '😊', label: 'Радость', key: '1' },
  { emotion: 'sad', icon: '😢', label: 'Грусть', key: '2' },
  { emotion: 'angry', icon: '😠', label: 'Злость', key: '3' },
  { emotion: 'surprised', icon: '😲', label: 'Удивление', key: '4' },
  { emotion: 'love', icon: '😍', label: 'Любовь', key: '5' },
  { emotion: 'wink', icon: '😉', label: 'Подмигивание', key: '6' },
];

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    x: 50, y: 50, animation: 'idle', direction: 'down',
    emotion: null, isRunning: false, isJumping: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeEmotion, setActiveEmotion] = useState<Emotion | null>(null);

  // Инициализация игры
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Устанавливаем размер canvas
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (engineRef.current) {
        engineRef.current.resize(window.innerWidth, window.innerHeight);
      }
    };
    resize();
    window.addEventListener('resize', resize);

    // Создаём движок
    const engine = new GameEngine(canvas);
    engineRef.current = engine;

    // Callback для обновления UI
    engine.setStateChangeCallback((state) => {
      setGameState(state);
      if (!state.emotion) {
        setActiveEmotion(null);
      }
    });

    // Запускаем
    engine.init().then(() => {
      setIsLoading(false);
    });

    return () => {
      window.removeEventListener('resize', resize);
      engine.destroy();
    };
  }, []);

  // Обработчик кнопок эмоций
  const handleEmotionClick = useCallback((emotion: Emotion) => {
    if (engineRef.current) {
      if (activeEmotion === emotion) {
        engineRef.current.setEmotion(null);
        setActiveEmotion(null);
      } else {
        engineRef.current.setEmotion(emotion);
        setActiveEmotion(emotion);
      }
    }
  }, [activeEmotion]);

  // Перевод анимации
  const getAnimationLabel = (anim: string): string => {
    const labels: { [key: string]: string } = {
      idle: 'Бездействие',
      walk: 'Ходьба',
      run: 'Бег',
      jump: 'Прыжок',
      emotion: 'Эмоция',
    };
    return labels[anim] || anim;
  };

  const getDirectionLabel = (dir: string): string => {
    const labels: { [key: string]: string } = {
      down: '↓ Вниз',
      up: '↑ Вверх',
      left: '← Влево',
      right: '→ Вправо',
    };
    return labels[dir] || dir;
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-900">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        tabIndex={0}
      />

      {/* Экран загрузки */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 border-r-4 border-purple-500 mx-auto mb-4"></div>
            <p className="text-white text-xl font-bold">Генерация мира...</p>
            <p className="text-gray-400 text-sm mt-2">Создание спрайтов и карты</p>
          </div>
        </div>
      )}

      {/* Панель эмоций */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {EMOTION_ICONS.map(({ emotion, icon, label, key }) => (
          <button
            key={emotion}
            onClick={() => handleEmotionClick(emotion)}
            className={`
              relative flex flex-col items-center justify-center
              w-14 h-14 rounded-xl transition-all duration-200
              ${activeEmotion === emotion
                ? 'bg-purple-600 scale-110 shadow-lg shadow-purple-500/50 ring-2 ring-purple-300'
                : 'bg-gray-800/80 hover:bg-gray-700/80 hover:scale-105'
              }
              backdrop-blur-sm border border-gray-600/50
            `}
            title={`${label} (${key})`}
          >
            <span className="text-2xl">{icon}</span>
            <span className="absolute -top-1 -right-1 text-[10px] bg-gray-900 text-gray-300 rounded px-1">
              {key}
            </span>
          </button>
        ))}
      </div>

      {/* Подсказки управления */}
      <div className="absolute bottom-4 right-4 z-10">
        <div className="bg-gray-800/80 backdrop-blur-sm rounded-lg p-3 border border-gray-600/50 text-xs text-gray-300 max-w-[200px]">
          <p className="font-bold text-white mb-1">Управление:</p>
          <p>WASD / Стрелки — движение</p>
          <p>Shift — бег</p>
          <p>Space — прыжок</p>
          <p>1-6 — эмоции</p>
        </div>
      </div>

      {/* Статус (мобильный) */}
      <div className="absolute top-4 left-4 z-10 md:hidden">
        <div className="bg-gray-800/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-gray-600/50">
          <p className="text-white text-xs">
            [{gameState.x}, {gameState.y}] {getAnimationLabel(gameState.animation)}
          </p>
        </div>
      </div>

      {/* Заголовок */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 hidden md:block">
        <div className="bg-gray-800/80 backdrop-blur-sm rounded-lg px-6 py-2 border border-gray-600/50">
          <h1 className="text-white font-bold text-lg tracking-wide">
            ⚔️ 2.5D RPG Adventure
          </h1>
        </div>
      </div>
    </div>
  );
}

export default App;
