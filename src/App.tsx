import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine, GameState } from './game/GameEngine';
import { GlobalMultiplayer, PlayerData, ChatMessage } from './game/GlobalMultiplayer';
import type { Emotion, Direction, AnimationType } from './game/SpriteGenerator';
import { VirtualJoystick } from './components/VirtualJoystick';
import { MobileControls } from './components/MobileControls';
import { ServerStatus } from './components/ServerStatus';
import { ChatPanel } from './components/ChatPanel';

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
  const mpRef = useRef<GlobalMultiplayer | null>(null);
  
  const [gameState, setGameState] = useState<GameState>({
    x: 50, y: 50, animation: 'idle', direction: 'down',
    emotion: null, isRunning: false, isJumping: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeEmotion, setActiveEmotion] = useState<Emotion | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  // Мультиплеер
  const [mpStatus, setMpStatus] = useState('Подключение...');
  const [mpConnected, setMpConnected] = useState(false);
  const [mpPlayers, setMpPlayers] = useState<PlayerData[]>([]);
  const [playerName, setPlayerName] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

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
      if (mpRef.current?.isConnected()) {
        mpRef.current.updateMyPlayer({
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
    });

    // Инициализация глобального мультиплеера
    const mp = new GlobalMultiplayer();
    mpRef.current = mp;
    setPlayerName(mp.getMyName());

    // Автоподключение
    mp.connect().then((success) => {
      setMpConnected(success);
    });

    mp.setOnPlayersUpdate((players: PlayerData[]) => {
      setMpPlayers(players);
      // Передаём других игроков в движок
      engine.setOtherPlayers(players.map((p: PlayerData) => ({
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

    mp.setOnStatusChange((status: string) => {
      setMpStatus(status);
    });

    mp.setOnChatMessage((msg: ChatMessage) => {
      setChatMessages(prev => [...prev.slice(-50), msg]);
    });

    return () => {
      window.removeEventListener('resize', resize);
      engine.destroy();
      mp.disconnect();
    };
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

      {/* Статус сервера */}
      <ServerStatus
        connected={mpConnected}
        status={mpStatus}
        playersCount={mpPlayers.length}
        myName={playerName}
        onNameChange={handleNameChange}
      />

      {/* Чат */}
      {mpConnected && (
        <ChatPanel
          messages={chatMessages}
          onSend={handleSendChat}
          myId={mpRef.current?.getMyId() || ''}
        />
      )}

      {/* Панель эмоций */}
      <div className={`absolute ${isMobile ? 'bottom-28' : 'bottom-4'} left-1/2 -translate-x-1/2 flex gap-1.5 z-10`}>
        {EMOTION_ICONS.map(({ emotion, icon, label, key }) => (
          <button
            key={emotion}
            onClick={() => handleEmotionClick(emotion)}
            className={`
              relative flex flex-col items-center justify-center
              ${isMobile ? 'w-11 h-11' : 'w-14 h-14'} rounded-xl transition-all duration-200
              ${activeEmotion === emotion
                ? 'bg-purple-600 scale-110 shadow-lg shadow-purple-500/50 ring-2 ring-purple-300'
                : 'bg-gray-800/80 hover:bg-gray-700/80 hover:scale-105'
              }
              backdrop-blur-sm border border-gray-600/50
            `}
            title={`${label} (${key})`}
          >
            <span className={isMobile ? 'text-lg' : 'text-2xl'}>{icon}</span>
            {!isMobile && (
              <span className="absolute -top-1 -right-1 text-[10px] bg-gray-900 text-gray-300 rounded px-1">
                {key}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Мобильные контролы */}
      {isMobile && (
        <>
          <div className="fixed bottom-8 left-8 z-20">
            <VirtualJoystick
              onMove={handleJoystickMove}
              onMoveEnd={handleJoystickEnd}
              size={130}
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
      {!isMobile && (
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

      {/* Статус */}
      <div className="absolute top-4 left-4 z-10">
        <div className="bg-gray-800/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-gray-600/50">
          <p className="text-white text-xs">
            [{gameState.x}, {gameState.y}] {getAnimationLabel(gameState.animation)}
          </p>
        </div>
      </div>

      {/* Заголовок (ПК) */}
      {!isMobile && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-gray-800/80 backdrop-blur-sm rounded-lg px-6 py-2 border border-gray-600/50">
            <h1 className="text-white font-bold text-lg tracking-wide">
              ⚔️ 2.5D RPG Adventure
            </h1>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
