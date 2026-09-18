// ============================================
// 🎮 Клиент мультиплеера (Socket.io)
// ============================================
// Подключение к серверу через WebSocket
// ============================================

import { io, Socket } from 'socket.io-client';

// URL сервера (замените на ваш после деплоя на Railway)
// Для локального теста: http://localhost:3001
// Для продакшена: https://your-app.up.railway.app
const SERVER_URL = 'http://localhost:3001';

export interface PlayerData {
  id: string;
  name: string;
  x: number;
  y: number;
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
      players.forEach(p => this.players.set(p.id, p));
      this.notifyPlayersUpdate();
    });

    this.socket.on('player:joined', (player: PlayerData) => {
      console.log('[Multiplayer] Игрок присоединился:', player.name);
      this.players.set(player.id, player);
      this.notifyPlayersUpdate();
    });

    this.socket.on('player:moved', (player: PlayerData) => {
      const existing = this.players.get(player.id);
      if (existing) {
        Object.assign(existing, player);
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
  // Обновление позиции (с троттлингом)
  // ============================================
  updatePlayer(data: { x: number; y: number; direction: string; animation: string; emotion: string | null }): void {
    if (!this.socket?.connected) return;

    const now = Date.now();
    if (now - this.lastUpdate < this.updateInterval) return;
    this.lastUpdate = now;

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
