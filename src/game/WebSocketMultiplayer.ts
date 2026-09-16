// WebSocket клиент для мультиплеера
// Подключается к собственному серверу

export interface PlayerData {
  id: string;
  name: string;
  x: number;
  y: number;
  direction: string;
  animation: string;
  emotion: string | null;
  color: string;
  lastSeen: number;
}

export interface ChatMessage {
  from: string;
  fromName: string;
  text: string;
  timestamp: number;
}

// URL сервера (замените на ваш после деплоя)
const SERVER_URL = 'wss://your-server.up.railway.app'; // Замените на ваш URL

export class WebSocketMultiplayer {
  private ws: WebSocket | null = null;
  private myId: string;
  private myName: string;
  private myColor: string;
  private connected: boolean = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  
  private players: Map<string, PlayerData> = new Map();
  private lastUpdate: number = 0;
  
  // Callbacks
  private onPlayersUpdate: ((players: PlayerData[]) => void) | null = null;
  private onChatMessage: ((msg: ChatMessage) => void) | null = null;
  private onStatusChange: ((status: string) => void) | null = null;
  private onConnectionChange: ((connected: boolean) => void) | null = null;

  constructor() {
    this.myId = this.generateId();
    this.myName = 'Игрок_' + Math.floor(Math.random() * 1000);
    this.myColor = this.getRandomColor();
  }

  private generateId(): string {
    const rand = Math.random().toString(36).substring(2, 15);
    const rand2 = Math.random().toString(36).substring(2, 15);
    return 'ws_' + Date.now().toString(36) + '_' + rand + rand2;
  }

  private getRandomColor(): string {
    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Подключение к серверу
  connect(): void {
    if (this.connected) return;
    
    this.notifyStatus('Подключение к серверу...');
    console.log('[WebSocket] Connecting to:', SERVER_URL);
    
    try {
      this.ws = new WebSocket(SERVER_URL);

      this.ws.onopen = () => {
        console.log('[WebSocket] ✓ Connected to server');
        this.connected = true;
        this.notifyStatus('Сервер подключён ✓');
        if (this.onConnectionChange) this.onConnectionChange(true);

        // Отправляем данные о себе
        this.ws!.send(JSON.stringify({
          type: 'join',
          id: this.myId,
          name: this.myName,
          x: 3200,
          y: 3200,
          direction: 'down',
          animation: 'idle',
          emotion: null,
          color: this.myColor
        }));
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (e) {
          console.error('[WebSocket] Error parsing message:', e);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        this.notifyStatus('Ошибка подключения');
      };

      this.ws.onclose = () => {
        console.log('[WebSocket] Connection closed');
        this.connected = false;
        if (this.onConnectionChange) this.onConnectionChange(false);
        
        // Автоматическое переподключение через 3 секунды
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
          }, 3000);
        }
      };
    } catch (e) {
      console.error('[WebSocket] Connection error:', e);
      this.notifyStatus('Ошибка подключения');
    }
  }

  private handleMessage(data: any): void {
    switch (data.type) {
      case 'players_list':
        // Получили список всех игроков
        for (const player of data.players) {
          if (player.id !== this.myId) {
            this.players.set(player.id, { ...player, lastSeen: Date.now() });
          }
        }
        if (this.onPlayersUpdate) this.onPlayersUpdate(this.getPlayers());
        break;

      case 'player_joined':
        if (data.player.id !== this.myId) {
          this.players.set(data.player.id, { ...data.player, lastSeen: Date.now() });
          if (this.onPlayersUpdate) this.onPlayersUpdate(this.getPlayers());
        }
        break;

      case 'player_update':
        if (data.player.id !== this.myId) {
          const player = this.players.get(data.player.id);
          if (player) {
            Object.assign(player, data.player);
            player.lastSeen = Date.now();
            if (this.onPlayersUpdate) this.onPlayersUpdate(this.getPlayers());
          }
        }
        break;

      case 'player_left':
        this.players.delete(data.id);
        if (this.onPlayersUpdate) this.onPlayersUpdate(this.getPlayers());
        break;

      case 'chat':
        if (data.from !== this.myId && this.onChatMessage) {
          this.onChatMessage({
            from: data.from,
            fromName: data.fromName,
            text: data.text,
            timestamp: data.timestamp
          });
        }
        break;
    }
  }

  // Обновление позиции (с троттлингом)
  updateMyPlayer(data: Partial<PlayerData>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const now = Date.now();
    if (now - this.lastUpdate < 100) return; // 10 раз в секунду
    this.lastUpdate = now;

    this.ws.send(JSON.stringify({
      type: 'update',
      ...data
    }));
  }

  // Отправка сообщения в чат
  sendChat(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const msg: ChatMessage = {
      from: this.myId,
      fromName: this.myName,
      text,
      timestamp: Date.now()
    };

    this.ws.send(JSON.stringify({
      type: 'chat',
      ...msg
    }));

    if (this.onChatMessage) this.onChatMessage(msg);
  }

  // Отключение
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.send(JSON.stringify({ type: 'leave' }));
      this.ws.close();
      this.ws = null;
    }
    
    this.connected = false;
    this.players.clear();
  }

  // Getters
  getPlayers(): PlayerData[] {
    return Array.from(this.players.values());
  }
  getMyId(): string { return this.myId; }
  getMyName(): string { return this.myName; }
  getMyColor(): string { return this.myColor; }
  isConnected(): boolean { return this.connected; }

  setMyName(name: string): void {
    this.myName = name;
  }

  // Callbacks
  setOnPlayersUpdate(cb: (players: PlayerData[]) => void) { this.onPlayersUpdate = cb; }
  setOnChatMessage(cb: (msg: ChatMessage) => void) { this.onChatMessage = cb; }
  setOnStatusChange(cb: (status: string) => void) { this.onStatusChange = cb; }
  setOnConnectionChange(cb: (connected: boolean) => void) { this.onConnectionChange = cb; }

  private notifyStatus(status: string): void {
    console.log('[Multiplayer]', status);
    if (this.onStatusChange) this.onStatusChange(status);
  }
}
