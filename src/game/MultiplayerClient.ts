// ============================================
// 🎮 Клиент мультиплеера (Socket.io)
// ============================================
// Подключение к серверу через WebSocket
// ============================================

import { io, Socket } from 'socket.io-client';

// URL сервера - определяем динамически в зависимости от окружения
const getServerUrl = (): string => {
  // Проверяем переменную окружения (для Vite)
  const envUrl = import.meta.env.VITE_SERVER_URL;
  if (envUrl) return envUrl;
  
  // Для локальной разработки
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3001';
  }
  
  // Для продакшена - используем тот же хост, что и фронтенд
  const protocol = window.location.protocol;
  return `${protocol}//${window.location.hostname}`;
};

const SERVER_URL = getServerUrl();

export interface PlayerData {
  id: string;
  name: string;
  x: number;
  y: number;
  targetX?: number; // Для интерполяции
  targetY?: number; // Для интерполяции
  direction: string;
  animation: string;
  emotion: string | null;
  color: string;
}

export interface ChatMessage {
  from: string;
  fromName: string;
  text: string;
  timestamp: number;
}

export class MultiplayerClient {
  private socket: Socket | null = null;
  private players: Map<string, PlayerData> = new Map();
  private connected: boolean = false;
  private lastUpdate: number = 0;
  private updateInterval: number = 100; // 10 обновлений в секунду
  private dynamicUpdateInterval: number = 50; // Динамический интервал (быстрее при движении)
  private isMoving: boolean = false;
  private pendingUpdate: { x: number; y: number; direction: string; animation: string; emotion: string | null } | null = null;

  // Callbacks
  private onPlayersUpdate: ((players: PlayerData[]) => void) | null = null;
  private onChatMessage: ((msg: ChatMessage) => void) | null = null;
  private onStatusChange: ((status: string) => void) | null = null;
  private onConnectionChange: ((connected: boolean) => void) | null = null;

  // ============================================
  // Подключение к серверу
  // ============================================
  connect(): void {
    if (this.socket?.connected) {
      console.log('[Multiplayer] Уже подключено');
      return;
    }

    this.notifyStatus('Подключение к серверу...');
    console.log('[Multiplayer] Подключение к:', SERVER_URL);

    this.socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    // ============================================
    // Обработчики событий
    // ============================================
    this.socket.on('connect', () => {
      console.log('[Multiplayer] ✓ Подключено к серверу');
      this.connected = true;
      this.notifyStatus('Сервер подключён ✓');
      if (this.onConnectionChange) this.onConnectionChange(true);
    });

    this.socket.on('disconnect', () => {
      console.log('[Multiplayer] Отключено от сервера');
      this.connected = false;
      this.notifyStatus('Соединение потеряно');
      if (this.onConnectionChange) this.onConnectionChange(false);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Multiplayer] Ошибка подключения:', error);
      this.notifyStatus('Ошибка подключения');
    });

    // ============================================
    // Обработка игроков
    // ============================================
    this.socket.on('players:list', (players: PlayerData[]) => {
      console.log('[Multiplayer] Получен список игроков:', players.length);
      this.players.clear();
      players.forEach(p => {
        // Инициализируем targetX и targetY для интерполяции
        const playerWithTargets = {
          ...p,
          targetX: p.x,
          targetY: p.y
        };
        this.players.set(p.id, playerWithTargets);
      });
      this.notifyPlayersUpdate();
    });

    this.socket.on('player:joined', (player: PlayerData) => {
      console.log('[Multiplayer] Игрок присоединился:', player.name);
      // Инициализируем targetX и targetY для интерполяции
      const playerWithTargets = {
        ...player,
        targetX: player.x,
        targetY: player.y
      };
      this.players.set(player.id, playerWithTargets);
      this.notifyPlayersUpdate();
    });

    this.socket.on('player:moved', (player: PlayerData) => {
      const existing = this.players.get(player.id);
      if (existing) {
        // Сохраняем текущую позицию для интерполяции
        const prevX = existing.x;
        const prevY = existing.y;
        
        // Обновляем данные игрока
        Object.assign(existing, player);
        
        // Устанавливаем целевую позицию для плавной интерполяции
        existing.x = prevX; // Остаёмся на старой позиции
        existing.targetX = player.x; // Целевая - новая позиция
        existing.targetY = player.y;
        
        this.notifyPlayersUpdate();
      }
    });

    this.socket.on('player:left', (data: { id: string }) => {
      console.log('[Multiplayer] Игрок вышел:', data.id);
      this.players.delete(data.id);
      this.notifyPlayersUpdate();
    });

    // ============================================
    // Обработка чата
    // ============================================
    this.socket.on('chat:message', (msg: ChatMessage) => {
      if (this.onChatMessage) this.onChatMessage(msg);
    });
  }

  // ============================================
  // Вход в игру
  // ============================================
  joinGame(name: string, x: number, y: number, color: string): void {
    if (!this.socket?.connected) return;

    this.socket.emit('player:join', {
      name,
      x,
      y,
      direction: 'down',
      animation: 'idle',
      emotion: null,
      color
    });
  }

  // ============================================
  // Обновление позиции (с динамическим троттлингом)
  // ============================================
  updatePlayer(data: { x: number; y: number; direction: string; animation: string; emotion: string | null }): void {
    if (!this.socket?.connected) return;

    // Определяем, движется ли игрок
    const isMovingNow = data.animation === 'walk' || data.animation === 'run';
    this.isMoving = isMovingNow;
    
    // Динамический интервал: чаще при движении, реже в покое
    const currentInterval = isMovingNow ? this.dynamicUpdateInterval : this.updateInterval;
    
    const now = Date.now();
    if (now - this.lastUpdate < currentInterval) {
      // Кэшируем последнее обновление для отправки при следующей возможности
      this.pendingUpdate = data;
      return;
    }
    
    this.lastUpdate = now;
    this.socket.emit('player:update', data);
    
    // Если есть закэшированное обновление, планируем его отправку
    if (this.pendingUpdate) {
      setTimeout(() => {
        if (this.pendingUpdate && this.socket?.connected) {
          const pending = this.pendingUpdate;
          this.pendingUpdate = null;
          this.socket.emit('player:update', pending);
        }
      }, currentInterval);
    }
  }

  // ============================================
  // Принудительная отправка обновления (для важных событий)
  // ============================================
  forceUpdate(data: { x: number; y: number; direction: string; animation: string; emotion: string | null }): void {
    if (!this.socket?.connected) return;
    
    this.lastUpdate = Date.now();
    this.pendingUpdate = null;
    this.socket.emit('player:update', data);
  }

  // ============================================
  // Отправка сообщения в чат
  // ============================================
  sendChat(text: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit('chat:message', { text });
  }

  // ============================================
  // Отключение
  // ============================================
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
    this.players.clear();
  }

  // ============================================
  // Getters
  // ============================================
  getPlayers(): PlayerData[] {
    return Array.from(this.players.values());
  }

  getMyId(): string {
    return this.socket?.id || '';
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ============================================
  // Callbacks
  // ============================================
  setOnPlayersUpdate(cb: (players: PlayerData[]) => void) {
    this.onPlayersUpdate = cb;
  }

  setOnChatMessage(cb: (msg: ChatMessage) => void) {
    this.onChatMessage = cb;
  }

  setOnStatusChange(cb: (status: string) => void) {
    this.onStatusChange = cb;
  }

  setOnConnectionChange(cb: (connected: boolean) => void) {
    this.onConnectionChange = cb;
  }

  private notifyPlayersUpdate(): void {
    if (this.onPlayersUpdate) {
      this.onPlayersUpdate(this.getPlayers());
    }
  }

  private notifyStatus(status: string): void {
    console.log('[Multiplayer]', status);
    if (this.onStatusChange) {
      this.onStatusChange(status);
    }
  }
}
