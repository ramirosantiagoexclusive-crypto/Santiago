// Мультиплеер менеджер с использованием PeerJS (P2P)
import Peer, { DataConnection } from 'peerjs';

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
  text: string;
  timestamp: number;
}

type Message =
  | { type: 'player_update'; data: PlayerData }
  | { type: 'player_join'; data: PlayerData }
  | { type: 'player_leave'; id: string }
  | { type: 'chat'; data: ChatMessage }
  | { type: 'world_sync'; players: PlayerData[] };

export class MultiplayerManager {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private players: Map<string, PlayerData> = new Map();
  private myId: string = '';
  private myName: string = '';
  private isHost: boolean = false;
  private roomCode: string = '';
  
  private onPlayersUpdate: ((players: PlayerData[]) => void) | null = null;
  private onChatMessage: ((msg: ChatMessage) => void) | null = null;
  private onConnectionStatus: ((status: string) => void) | null = null;

  constructor() {
    // Генерируем уникальное имя
    this.myName = 'Игрок_' + Math.floor(Math.random() * 1000);
  }

  // Инициализация PeerJS
  async init(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.peer = new Peer({
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ]
        }
      });

      this.peer.on('open', (id) => {
        this.myId = id;
        console.log('My peer ID:', id);
        resolve(id);
      });

      this.peer.on('error', (err) => {
        console.error('Peer error:', err);
        reject(err);
      });

      // Обработка входящих подключений (для хоста)
      this.peer.on('connection', (conn) => {
        this.handleConnection(conn);
      });
    });
  }

  // Создать комнату (хост)
  async createRoom(): Promise<string> {
    if (!this.peer) await this.init();
    
    this.isHost = true;
    this.roomCode = this.myId;
    
    // Добавляем себя как первого игрока
    const myPlayer: PlayerData = {
      id: this.myId,
      name: this.myName,
      x: 3200, // Центр карты
      y: 3200,
      direction: 'down',
      animation: 'idle',
      emotion: null,
      color: this.getRandomColor(),
    };
    this.players.set(this.myId, myPlayer);
    
    this.notifyStatus('Комната создана. Код: ' + this.roomCode.substring(0, 8));
    return this.roomCode;
  }

  // Подключиться к комнате
  async joinRoom(roomCode: string): Promise<boolean> {
    if (!this.peer) await this.init();
    
    this.isHost = false;
    this.roomCode = roomCode;
    
    return new Promise((resolve) => {
      const conn = this.peer!.connect(roomCode, { reliable: true });
      
      conn.on('open', () => {
        console.log('Connected to host');
        this.connections.set(roomCode, conn);
        
        // Отправляем свои данные хосту
        const myPlayer: PlayerData = {
          id: this.myId,
          name: this.myName,
          x: 3200,
          y: 3200,
          direction: 'down',
          animation: 'idle',
          emotion: null,
          color: this.getRandomColor(),
        };
        this.players.set(this.myId, myPlayer);
        
        this.sendMessage(conn, { type: 'player_join', data: myPlayer });
        this.notifyStatus('Подключено к комнате');
        resolve(true);
      });

      conn.on('data', (data) => {
        this.handleMessage(conn, data as Message);
      });

      conn.on('close', () => {
        this.connections.delete(roomCode);
        this.notifyStatus('Отключено от комнаты');
        resolve(false);
      });

      conn.on('error', (err) => {
        console.error('Connection error:', err);
        this.notifyStatus('Ошибка подключения');
        resolve(false);
      });

      // Таймаут подключения
      setTimeout(() => {
        if (!conn.open) {
          this.notifyStatus('Таймаут подключения');
          resolve(false);
        }
      }, 10000);
    });
  }

  // Обработка входящего подключения
  private handleConnection(conn: DataConnection) {
    conn.on('open', () => {
      console.log('New connection from:', conn.peer);
      this.connections.set(conn.peer, conn);
      this.notifyStatus('Игрок подключился');
      
      // Отправляем текущий список игроков новому подключению
      const playersList = Array.from(this.players.values());
      this.sendMessage(conn, { type: 'world_sync', players: playersList });
    });

    conn.on('data', (data) => {
      this.handleMessage(conn, data as Message);
    });

    conn.on('close', () => {
      console.log('Connection closed:', conn.peer);
      this.connections.delete(conn.peer);
      this.players.delete(conn.peer);
      this.broadcast({ type: 'player_leave', id: conn.peer });
      this.notifyPlayersUpdate();
      this.notifyStatus('Игрок отключился');
    });
  }

  // Обработка входящих сообщений
  private handleMessage(conn: DataConnection, msg: Message) {
    switch (msg.type) {
      case 'player_update':
        this.players.set(msg.data.id, msg.data);
        // Если мы хост, пересылаем другим
        if (this.isHost) {
          this.broadcastExcept(conn.peer, msg);
        }
        this.notifyPlayersUpdate();
        break;

      case 'player_join':
        this.players.set(msg.data.id, msg.data);
        if (this.isHost) {
          this.broadcastExcept(conn.peer, msg);
        }
        this.notifyPlayersUpdate();
        this.notifyStatus(`${msg.data.name} присоединился`);
        break;

      case 'player_leave':
        this.players.delete(msg.id);
        if (this.isHost) {
          this.broadcastExcept(conn.peer, msg);
        }
        this.notifyPlayersUpdate();
        break;

      case 'chat':
        if (this.onChatMessage) {
          this.onChatMessage(msg.data);
        }
        if (this.isHost) {
          this.broadcastExcept(conn.peer, msg);
        }
        break;

      case 'world_sync':
        // Получили полный список игроков от хоста
        for (const player of msg.players) {
          this.players.set(player.id, player);
        }
        this.notifyPlayersUpdate();
        break;
    }
  }

  // Обновить позицию своего игрока
  updateMyPlayer(data: Partial<PlayerData>) {
    const myPlayer = this.players.get(this.myId);
    if (!myPlayer) return;

    Object.assign(myPlayer, data);
    
    const msg: Message = { type: 'player_update', data: myPlayer };
    
    // Отправляем всем подключенным
    if (this.isHost) {
      this.broadcast(msg);
    } else {
      // Отправляем только хосту
      for (const conn of this.connections.values()) {
        this.sendMessage(conn, msg);
      }
    }
  }

  // Отправить сообщение в чат
  sendChat(text: string) {
    const msg: ChatMessage = {
      from: this.myName,
      text,
      timestamp: Date.now(),
    };
    
    const message: Message = { type: 'chat', data: msg };
    
    if (this.isHost) {
      this.broadcast(message);
    } else {
      for (const conn of this.connections.values()) {
        this.sendMessage(conn, message);
      }
    }
    
    // Локально тоже показываем
    if (this.onChatMessage) {
      this.onChatMessage(msg);
    }
  }

  // Получить всех игроков
  getPlayers(): PlayerData[] {
    return Array.from(this.players.values());
  }

  getMyId(): string {
    return this.myId;
  }

  getMyName(): string {
    return this.myName;
  }

  setMyName(name: string) {
    this.myName = name;
  }

  isInRoom(): boolean {
    return this.roomCode !== '';
  }

  getRoomCode(): string {
    return this.roomCode;
  }

  // Вспомогательные методы
  private sendMessage(conn: DataConnection, msg: Message) {
    if (conn.open) {
      conn.send(msg);
    }
  }

  private broadcast(msg: Message) {
    for (const conn of this.connections.values()) {
      this.sendMessage(conn, msg);
    }
  }

  private broadcastExcept(exceptId: string, msg: Message) {
    for (const [id, conn] of this.connections.entries()) {
      if (id !== exceptId) {
        this.sendMessage(conn, msg);
      }
    }
  }

  private getRandomColor(): string {
    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Callbacks
  setOnPlayersUpdate(callback: (players: PlayerData[]) => void) {
    this.onPlayersUpdate = callback;
  }

  setOnChatMessage(callback: (msg: ChatMessage) => void) {
    this.onChatMessage = callback;
  }

  setOnConnectionStatus(callback: (status: string) => void) {
    this.onConnectionStatus = callback;
  }

  private notifyPlayersUpdate() {
    if (this.onPlayersUpdate) {
      this.onPlayersUpdate(this.getPlayers());
    }
  }

  private notifyStatus(status: string) {
    if (this.onConnectionStatus) {
      this.onConnectionStatus(status);
    }
  }

  // Отключение
  disconnect() {
    for (const conn of this.connections.values()) {
      conn.close();
    }
    this.connections.clear();
    this.players.clear();
    this.roomCode = '';
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}
