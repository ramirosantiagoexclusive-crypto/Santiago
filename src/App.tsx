import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine, GameState } from './game/GameEngine';
import { MultiplayerClient, PlayerData, ChatMessage } from './game/MultiplayerClient';
import type { Emotion, Direction, AnimationType } from './game/SpriteGenerator';
import { VirtualJoystick } from './components/VirtualJoystick';
import { MobileControls } from './components/MobileControls';
import { ServerStatus } from './components/ServerStatus';
import { ChatPanel } from './components/ChatPanel';
import { NameModal } from './components/NameModal';

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
  const mpRef = useRef<MultiplayerClient | null>(null);
  
  const [gameState, setGameState] = useState<GameState>({
    x: 50, y: 50, animation: 'idle', direction: 'down',
    emotion: null, isRunning: false, isJumping: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeEmotion, setActiveEmotion] = useState<Emotion | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  // Мультиплеер
  const [mpStatus, setMpStatus] = useState('Инициализация...');
  const [mpConnected, setMpConnected] = useState(false);
  const [mpPlayers, setMpPlayers] = useState<PlayerData[]>([]);
  const [playerName, setPlayerName] = useState('');
  const [playerColor, setPlayerColor] = useState('#3B82F6');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [showNameModal, setShowNameModal] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);

  // Определяем мобильное устройство
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Инициализация игры
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (engineRef.current) {
        engineRef.current.resize(window.innerWidth, window.innerHeight);
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const engine = new GameEngine(canvas);
    engineRef.current = engine;

    engine.setStateChangeCallback((state) => {
      setGameState(state);
      if (!state.emotion) setActiveEmotion(null);

      // Отправляем обновление на сервер
      if (mpRef.current?.isConnected() && hasJoined) {
        mpRef.current.updatePlayer({
          x: state.x * 64,
          y: state.y * 64,
          direction: state.direction as Direction,
          animation: state.animation as AnimationType,
          emotion: state.emotion as Emotion | null,
        });
      }
    });

    engine.init().then(() => {
      setIsLoading(false);
      // Показываем модальное окно для ввода имени
      setShowNameModal(true);
    });

    // Инициализация мультиплеера
    const mp = new MultiplayerClient();
    mpRef.current = mp;

    // Автоподключение
    mp.connect();

    mp.setOnPlayersUpdate((players) => {
      setMpPlayers(players);
      // Передаём других игроков в движок
      engine.setOtherPlayers(players.map((p) => ({
        id: p.id,
        name: p.name,
        x: p.x,
        y: p.y,
        direction: p.direction as Direction,
        animation: p.animation as AnimationType,
        emotion: p.emotion as Emotion | null,
        color: p.color,
      })));
    });

    mp.setOnStatusChange((status) => {
      setMpStatus(status);
    });

    mp.setOnConnectionChange((connected) => {
      setMpConnected(connected);
    });

    mp.setOnChatMessage((msg) => {
      setChatMessages(prev => [...prev.slice(-50), msg]);
    });

    return () => {
      window.removeEventListener('resize', resize);
      engine.destroy();
      mp.disconnect();
    };
  }, [hasJoined]);

  // Обработчик ввода имени
  const handleNameSubmit = useCallback((name: string) => {
    setPlayerName(name);
    // Генерируем случайный цвет
    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    setPlayerColor(color);
    
    // Входим в игру
    if (mpRef.current) {
      mpRef.current.joinGame(name, 3200, 3200, color);
    }
    
    setShowNameModal(false);
    setHasJoined(true);
  }, []);

  // Обработчики эмоций
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

  // Мобильное управление
  const handleJoystickMove = useCallback((x: number, y: number) => {
    engineRef.current?.setExternalInput(x, y);
  }, []);

  const handleJoystickEnd = useCallback(() => {
    engineRef.current?.clearExternalInput();
  }, []);

  const handleJump = useCallback(() => {
    engineRef.current?.doJump();
  }, []);

  const handleRun = useCallback((running: boolean) => {
    setIsRunning(running);
    engineRef.current?.setRunning(running);
  }, []);

  const handleNameChange = useCallback((name: string) => {
    setPlayerName(name);
    mpRef.current?.setMyName(name);
  }, []);

  const handleSendChat = useCallback((text: string) => {
    mpRef.current?.sendChat(text);
  }, []);

  // Переводы
  const getAnimationLabel = (anim: string): string => {
    const labels: { [key: string]: string } = {
      idle: 'Бездействие', walk: 'Ходьба', run: 'Бег',
      jump: 'Прыжок', emotion: 'Эмоция',
    };
    return labels[anim] || anim;
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-900">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        tabIndex={0}
      />

      {/* Модальное окно для ввода имени */}
      {showNameModal && <NameModal onSubmit={handleNameSubmit} />}

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

      {/* Статус сервера - скрыт на мобильных */}
      {!isMobile && (
        <ServerStatus
          connected={mpConnected}
          connecting={!mpConnected}
          status={mpStatus}
          playersCount={mpPlayers.length + (hasJoined ? 1 : 0)}
          myName={playerName}
          onNameChange={handleNameChange}
        />
      )}

      {/* Чат */}
      {mpConnected && hasJoined && (
        <ChatPanel
          messages={chatMessages}
          onSend={handleSendChat}
          myId={mpRef.current?.getMyId() || ''}
        />
      )}

      {/* Панель эмоций */}
      {hasJoined && (
        <div className={`absolute ${isMobile ? 'bottom-32' : 'bottom-4'} left-1/2 -translate-x-1/2 flex gap-1 z-10`}>
          {EMOTION_ICONS.map(({ emotion, icon, label, key }) => (
            <button
              key={emotion}
              onClick={() => handleEmotionClick(emotion)}
              className={`
                relative flex items-center justify-center
                ${isMobile ? 'w-10 h-10' : 'w-14 h-14'} rounded-lg transition-all duration-200
                ${activeEmotion === emotion
                  ? 'bg-purple-600 scale-110 shadow-lg shadow-purple-500/50'
                  : 'bg-gray-800/70 active:bg-gray-700'
                }
                backdrop-blur-sm border border-gray-600/30
              `}
              title={`${label}`}
            >
              <span className={isMobile ? 'text-base' : 'text-2xl'}>{icon}</span>
            </button>
          ))}
        </div>
      )}

      {/* Мобильные контролы */}
      {isMobile && hasJoined && (
        <>
          <div className="fixed bottom-4 left-4 z-20 md:hidden">
            <VirtualJoystick
              onMove={handleJoystickMove}
              onMoveEnd={handleJoystickEnd}
              size={120}
            />
          </div>
          <MobileControls
            onJump={handleJump}
            onRun={handleRun}
            isRunning={isRunning}
          />
        </>
      )}

      {/* Подсказки управления (ПК) */}
      {!isMobile && hasJoined && (
        <div className="absolute bottom-4 right-4 z-10">
          <div className="bg-gray-800/80 backdrop-blur-sm rounded-lg p-3 border border-gray-600/50 text-xs text-gray-300 max-w-[200px]">
            <p className="font-bold text-white mb-1">Управление:</p>
            <p>WASD / Стрелки — движение</p>
            <p>Shift — бег</p>
            <p>Space — прыжок</p>
            <p>1-6 — эмоции</p>
          </div>
        </div>
      )}

      {/* Статус - только на ПК */}
      {!isMobile && hasJoined && (
        <div className="absolute top-4 left-4 z-10">
          <div className="bg-gray-800/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-gray-600/50">
            <p className="text-white text-xs">
              [{gameState.x}, {gameState.y}] {getAnimationLabel(gameState.animation)}
            </p>
          </div>
        </div>
      )}

      {/* Заголовок - только на ПК */}
      {!isMobile && hasJoined && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-gray-800/80 backdrop-blur-sm rounded-lg px-6 py-2 border border-gray-600/50">
            <h1 className="text-white font-bold text-lg tracking-wide">
              ⚔️ 2.5D RPG Adventure
            </h1>
          </div>
        </div>
      )}

      {/* Мобильный индикатор подключения - компактный */}
      {isMobile && hasJoined && (
        <div className="fixed top-2 right-2 z-30 md:hidden">
          <div className={`px-2 py-1 rounded-full text-xs font-bold ${
            mpConnected ? 'bg-green-600/80 text-white' : 'bg-red-600/80 text-white'
          }`}>
            {mpConnected ? '●' : '○'} {mpPlayers.length + 1}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
