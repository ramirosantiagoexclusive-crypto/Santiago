// ============================================
// 🎮 PeerJS мультиплеер (работает без сервера!)
// ============================================
// Использует публичный PeerJS сервер для P2P соединений
// Гарантированно работает без деплоя
// ============================================

// Динамическая загрузка PeerJS чтобы не блокировать UI
type PeerType = any;
type DataConnectionType = any;
let PeerModule: any = null;

async function loadPeerJS(): Promise<any> {
  if (!PeerModule) {
    PeerModule = await import('peerjs');
  }
  return PeerModule;
}

export interface PlayerData {
  id: string;
  name: string;
  x: number;
  y: number;
  direction: string;
  animation: string;
  emotion: string | null;
  color: string;
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
// Класс мультиплеера на PeerJS
// ============================================
export class MultiplayerClient {
  private peer: any = null;
  private connections: Map<string, any> = new Map();
  private players: Map<string, PlayerData> = new Map();
  private myId: string = '';
  private myName: string = '';
  private myColor: string = '';
  private connected: boolean = false;
  private lastUpdate: number = 0;
  private updateInterval: number = 100; // 10 обновлений в секунду
  
  // Callbacks
  private onPlayersUpdate: ((players: PlayerData[]) => void) | null = null;
  private onChatMessage: ((msg: ChatMessage) => void) | null = null;
  private onStatusChange: ((status: string) => void) | null = null;
  private onConnectionChange: ((connected: boolean) => void) | null = null;

  constructor() {
    this.myId = this.generateId();
    console.log('[PeerJS] Инициализация клиента...');
    console.log('[PeerJS] Мой ID:', this.myId);
  }

  private generateId(): string {
    return 'player_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  }

  // ============================================
  // Подключение к PeerJS серверу
  // ============================================
  async connect(): Promise<void> {
    if (this.peer) {
      console.log('[PeerJS] Уже подключено');
      return;
    }

    this.notifyStatus('Подключение к серверу...');
    console.log('[PeerJS] Подключение к публичному серверу...');

    try {
      // Динамическая загрузка PeerJS
      const peerModule = await loadPeerJS();
      const Peer = peerModule.default;
      
      // Подключаемся к публичному PeerJS серверу
      this.peer = new Peer(this.myId, {
        host: '0.peerjs.com',
        port: 443,
        path: '/peerjs',
        secure: true,
        debug: 1
      });

      // ============================================
      // Обработчики событий
      // ============================================
      this.peer.on('open', (id: string) => {
        console.log('[PeerJS] ✓ Подключено с ID:', id);
        this.myId = id;
        this.connected = true;
        this.notifyStatus('Сервер подключён ✓');
        if (this.onConnectionChange) this.onConnectionChange(true);
      });

      this.peer.on('connection', (conn: any) => {
        console.log('[PeerJS] Новое подключение:', conn.peer);
        this.handleConnection(conn);
      });

      this.peer.on('error', (err: any) => {
        console.error('[PeerJS] Ошибка:', err);
        this.notifyStatus('Ошибка подключения');
        
        // Автоматическое переподключение
        setTimeout(() => {
          if (!this.connected) {
            this.connect();
          }
        }, 3000);
      });

      this.peer.on('disconnected', () => {
        console.log('[PeerJS] Отключено');
        this.connected = false;
        this.notifyStatus('Соединение потеряно');
        if (this.onConnectionChange) this.onConnectionChange(false);
        
        // Автоматическое переподключение
        setTimeout(() => {
          this.peer?.reconnect();
        }, 3000);
      });

    } catch (error) {
      console.error('[PeerJS] Критическая ошибка:', error);
      this.notifyStatus('Ошибка подключения');
    }
  }

  // ============================================
  // Обработка новых подключений
  // ============================================
  private handleConnection(conn: any): void {
    conn.on('open', () => {
      console.log('[PeerJS] Соединение открыто с:', conn.peer);
      this.connections.set(conn.peer, conn);

      // Отправляем свои данные новому игроку
      conn.send({
        type: 'player:join',
        player: {
          id: this.myId,
          name: this.myName,
          x: 3200,
          y: 3200,
          direction: 'down',
          animation: 'idle',
          emotion: null,
          color: this.myColor
        }
      });

      // Отправляем список всех известных игроков
      const playersList = Array.from(this.players.values());
      conn.send({
        type: 'players:list',
        players: playersList
      });
    });

    conn.on('data', (data: any) => {
      this.handleMessage(conn.peer, data);
    });

    conn.on('close', () => {
      console.log('[PeerJS] Соединение закрыто:', conn.peer);
      this.connections.delete(conn.peer);
      this.players.delete(conn.peer);
      
      // Системное сообщение
      const player = this.players.get(conn.peer);
      if (player && this.onChatMessage) {
        this.onChatMessage({
          from: 'system',
          fromName: 'Система',
          text: `${player.name} покинул игру`,
          timestamp: Date.now(),
          system: true
        });
      }
      
      this.players.delete(conn.peer);
      this.notifyPlayersUpdate();
    });

    conn.on('error', (err: any) => {
      console.error('[PeerJS] Ошибка соединения:', err);
      this.connections.delete(conn.peer);
    });
  }

  // ============================================
  // Обработка входящих сообщений
  // ============================================
  private handleMessage(fromId: string, data: any): void {
    switch (data.type) {
      case 'player:join':
        console.log('[PeerJS] Игрок присоединился:', data.player.name);
        this.players.set(data.player.id, {
          ...data.player,
          targetX: data.player.x,
          targetY: data.player.y,
          lastUpdate: Date.now()
        });
        
        // Системное сообщение
        if (this.onChatMessage) {
          this.onChatMessage({
            from: 'system',
            fromName: 'Система',
            text: `${data.player.name} присоединился к игре`,
            timestamp: Date.now(),
            system: true
          });
        }
        
        this.notifyPlayersUpdate();
        break;

      case 'player:update':
        const player = this.players.get(data.player.id);
        if (player) {
          player.targetX = data.player.x;
          player.targetY = data.player.y;
          player.direction = data.player.direction;
          player.animation = data.player.animation;
          player.emotion = data.player.emotion;
          player.lastUpdate = Date.now();
        }
        break;

      case 'players:list':
        data.players.forEach((p: any) => {
          if (p.id !== this.myId) {
            this.players.set(p.id, {
              ...p,
              targetX: p.x,
              targetY: p.y,
              lastUpdate: Date.now()
            });
          }
        });
        this.notifyPlayersUpdate();
        break;

      case 'chat:message':
        if (this.onChatMessage) {
          this.onChatMessage(data.message);
        }
        break;
    }
  }

  // ============================================
  // Вход в игру
  // ============================================
  joinGame(name: string, x: number, y: number, color: string): void {
    this.myName = name;
    this.myColor = color;

    console.log('[PeerJS] Вход в игру:', name);

    // Отправляем свои данные всем подключенным
    this.broadcast({
      type: 'player:join',
      player: {
        id: this.myId,
        name: this.myName,
        x,
        y,
        direction: 'down',
        animation: 'idle',
        emotion: null,
        color: this.myColor
      }
    });
  }

  // ============================================
  // Обновление позиции (с троттлингом)
  // ============================================
  updatePlayer(data: { x: number; y: number; direction: string; animation: string; emotion: string | null }): void {
    if (!this.connected) return;

    const now = Date.now();
    if (now - this.lastUpdate < this.updateInterval) return;
    this.lastUpdate = now;

    this.broadcast({
      type: 'player:update',
      player: {
        id: this.myId,
        ...data
      }
    });
  }

  // ============================================
  // Отправка сообщения в чат
  // ============================================
  sendChat(text: string): void {
    if (!this.connected) return;

    const message: ChatMessage = {
      from: this.myId,
      fromName: this.myName,
      text,
      timestamp: Date.now()
    };

    this.broadcast({
      type: 'chat:message',
      message
    });

    // Локально тоже показываем
    if (this.onChatMessage) {
      this.onChatMessage(message);
    }
  }

  // ============================================
  // Рассылка сообщения всем подключениям
  // ============================================
  private broadcast(data: any): void {
    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.send(data);
      }
    });
  }

  // ============================================
  // Интерполяция позиций других игроков
  // ============================================
  interpolatePlayers(): void {
    const lerpFactor = 0.15;
    
    this.players.forEach(player => {
      player.x += (player.targetX - player.x) * lerpFactor;
      player.y += (player.targetY - player.y) * lerpFactor;
    });
  }

  // ============================================
  // Отключение
  // ============================================
  disconnect(): void {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.connections.clear();
    this.players.clear();
    this.connected = false;
  }

  // ============================================
  // Getters
  // ============================================
  getPlayers(): PlayerData[] {
    return Array.from(this.players.values());
  }

  getMyId(): string {
    return this.myId;
  }

  getMyName(): string {
    return this.myName;
  }

  isConnected(): boolean {
    return this.connected;
  }

  setMyName(name: string): void {
    this.myName = name;
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

  private notifyPlayersUpdate(): void {
    if (this.onPlayersUpdate) {
      this.onPlayersUpdate(this.getPlayers());
    }
  }

  private notifyStatus(status: string): void {
    console.log('[PeerJS]', status);
    if (this.onStatusChange) {
      this.onStatusChange(status);
    }
  }
}
