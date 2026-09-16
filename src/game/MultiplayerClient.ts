// ============================================
// 🎮 Socket.io клиент для мультиплеера
// ============================================
// Подключение к WebSocket серверу для синхронизации игроков
// ============================================

import { io, Socket } from 'socket.io-client';

// URL сервера (замените на ваш после деплоя на Railway)
// Для локального теста: http://localhost:3001
// Для продакшена: https://your-app.up.railway.app
const SERVER_URL = (window as any).__VITE_WS_URL__ || 'https://rpg25d-server.up.railway.app';

// ============================================
// Типы данных
// ============================================
export interface PlayerData {
  id: string;
  name: string;
  x: number;
  y: number;
  direction: string;
  animation: string;
  emotion: string | null;
  color: string;
  // Для интерполяции
  targetX: number;
  targetY: number;
  lastUpdate: number;
}

export interface ChatMessage {
  from: string;
  fromName: string;
  text: string;
  timestamp: number;
  system?: boolean;
}

// ============================================
// Класс мультиплеера
// ============================================
export class MultiplayerClient {
  private socket: Socket | null = null;
  private players: Map<string, PlayerData> = new Map();
  private connected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private lastUpdate: number = 0;
  private updateInterval: number = 100; // 10 обновлений в секунду
  
  // Callbacks
  private onPlayersUpdate: ((players: PlayerData[]) => void) | null = null;
  private onChatMessage: ((msg: ChatMessage) => void) | null = null;
  private onStatusChange: ((status: string) => void) | null = null;
  private onConnectionChange: ((connected: boolean) => void) | null = null;

  constructor() {
    console.log('[Multiplayer] Инициализация клиента...');
    console.log('[Multiplayer] Сервер:', SERVER_URL);
  }

  // ============================================
  // Подключение к серверу
  // ============================================
  connect(): void {
    if (this.socket?.connected) {
      console.log('[Multiplayer] Уже подключено');
      return;
    }

    this.notifyStatus('Подключение к серверу...');
    console.log('[Multiplayer] Подключение...');

    try {
      this.socket = io(SERVER_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000
      });

      // ============================================
      // Обработчики событий
      // ============================================
      this.socket.on('connect', () => {
        console.log('[Multiplayer] ✓ Подключено к серверу');
        this.connected = true;
        this.reconnectAttempts = 0;
        this.notifyStatus('Сервер подключён ✓');
        if (this.onConnectionChange) this.onConnectionChange(true);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('[Multiplayer] Отключено:', reason);
        this.connected = false;
        this.notifyStatus('Соединение потеряно');
        if (this.onConnectionChange) this.onConnectionChange(false);
      });

      this.socket.on('connect_error', (error) => {
        console.error('[Multiplayer] Ошибка подключения:', error.message);
        this.reconnectAttempts++;
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.notifyStatus('Не удалось подключиться к серверу');
        } else {
          this.notifyStatus(`Переподключение... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        }
      });

      // ============================================
      // Обработка игроков
      // ============================================
      this.socket.on('players:list', (players: PlayerData[]) => {
        console.log(`[Multiplayer] Получен список игроков: ${players.length}`);
        this.players.clear();
        
        players.forEach(player => {
          this.players.set(player.id, {
            ...player,
            targetX: player.x,
            targetY: player.y,
            lastUpdate: Date.now()
          });
        });
        
        this.notifyPlayersUpdate();
      });

      this.socket.on('player:joined', (player: PlayerData) => {
        console.log(`[Multiplayer] Игрок присоединился: ${player.name}`);
        this.players.set(player.id, {
          ...player,
          targetX: player.x,
          targetY: player.y,
          lastUpdate: Date.now()
        });
        this.notifyPlayersUpdate();
      });

      this.socket.on('player:moved', (data: any) => {
        const player = this.players.get(data.id);
        if (player) {
          // Обновляем целевую позицию для интерполяции
          player.targetX = data.x;
          player.targetY = data.y;
          player.direction = data.direction;
          player.animation = data.animation;
          player.emotion = data.emotion;
          player.lastUpdate = Date.now();
        }
      });

      this.socket.on('player:left', (data: { id: string }) => {
        console.log(`[Multiplayer] Игрок отключился: ${data.id}`);
        this.players.delete(data.id);
        this.notifyPlayersUpdate();
      });

      this.socket.on('player:renamed', (data: { id: string; oldName: string; newName: string }) => {
        const player = this.players.get(data.id);
        if (player) {
          player.name = data.newName;
          this.notifyPlayersUpdate();
        }
      });

      // ============================================
      // Обработка чата
      // ============================================
      this.socket.on('chat:message', (msg: ChatMessage) => {
        if (this.onChatMessage) this.onChatMessage(msg);
      });

      this.socket.on('chat:system', (msg: { text: string; timestamp: number }) => {
        if (this.onChatMessage) {
          this.onChatMessage({
            from: 'system',
            fromName: 'Система',
            text: msg.text,
            timestamp: msg.timestamp,
            system: true
          });
        }
      });

    } catch (error) {
      console.error('[Multiplayer] Критическая ошибка:', error);
      this.notifyStatus('Ошибка подключения');
    }
  }

  // ============================================
  // Вход в игру
  // ============================================
  joinGame(name: string, x: number, y: number, color: string): void {
    if (!this.socket?.connected) {
      console.warn('[Multiplayer] Нельзя войти - нет подключения');
      return;
    }

    this.socket.emit('player:join', {
      name,
      x,
      y,
      direction: 'down',
      animation: 'idle',
      emotion: null,
      color
    });

    console.log('[Multiplayer] Вход в игру:', name);
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
  // Смена имени
  // ============================================
  rename(newName: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit('player:rename', { name: newName });
  }

  // ============================================
  // Интерполяция позиций других игроков
  // ============================================
  interpolatePlayers(): void {
    const lerpFactor = 0.15; // Плавность интерполяции
    
    this.players.forEach(player => {
      // Интерполяция к целевой позиции
      player.x += (player.targetX - player.x) * lerpFactor;
      player.y += (player.targetY - player.y) * lerpFactor;
    });
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

  isConnected(): boolean {
    return this.connected;
  }

  getMyId(): string {
    return this.socket?.id || '';
  }

  getMyName(): string {
    return 'Игрок'; // Будет установлено при входе
  }

  setMyName(name: string): void {
    this.rename(name);
  }

  isInRoom(): boolean {
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

  // ============================================
  // Вспомогательные методы
  // ============================================
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
