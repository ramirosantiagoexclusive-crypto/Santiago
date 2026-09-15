// Полноценный серверный мультиплеер через MQTT
// Все сообщения идут через центральный MQTT broker (сервер)
// Это НЕ P2P — broker авторитетный релей

import mqtt, { MqttClient } from 'mqtt';

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

// Публичные MQTT broker'ы (бесплатные, работают через WebSocket)
const MQTT_BROKERS = [
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://mqtt.eclipseprojects.io:443',
  'wss://test.mosquitto.org:8081',
];

const TOPIC_PREFIX = 'rpg25d_game';

export class ServerMultiplayerManager {
  private client: MqttClient | null = null;
  private myId: string;
  private myName: string;
  private myColor: string;
  private roomCode: string = '';
  private isConnected: boolean = false;
  private isHost: boolean = false;
  
  private players: Map<string, PlayerData> = new Map();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private brokerIndex: number = 0;
  
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
    return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
  }

  private getRandomColor(): string {
    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Подключение к MQTT broker (серверу)
  private connectToBroker(): Promise<void> {
    return new Promise((resolve, reject) => {
      const brokerUrl = MQTT_BROKERS[this.brokerIndex];
      this.notifyStatus(`Подключение к серверу...`);

      const client = mqtt.connect(brokerUrl, {
        clientId: this.myId,
        clean: true,
        connectTimeout: 10000,
        reconnectPeriod: 5000,
        keepalive: 30,
      });

      const timeout = setTimeout(() => {
        client.end(true);
        reject(new Error('Таймаут подключения'));
      }, 10000);

      client.on('connect', () => {
        clearTimeout(timeout);
        this.client = client;
        this.isConnected = true;
        this.notifyStatus('Подключено к серверу');
        if (this.onConnectionChange) this.onConnectionChange(true);
        resolve();
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        console.error('MQTT error:', err);
        
        // Пробуем следующий broker
        this.brokerIndex = (this.brokerIndex + 1) % MQTT_BROKERS.length;
        if (this.brokerIndex === 0) {
          reject(new Error('Не удалось подключиться к серверу'));
        } else {
          client.end(true);
          this.connectToBroker().then(resolve).catch(reject);
        }
      });

      client.on('close', () => {
        this.isConnected = false;
        if (this.onConnectionChange) this.onConnectionChange(false);
      });

      client.on('message', (topic, message) => {
        this.handleMessage(topic, message.toString());
      });
    });
  }

  // Создать комнату (хост)
  async createRoom(): Promise<string> {
    if (!this.isConnected) {
      await this.connectToBroker();
    }

    this.isHost = true;
    this.roomCode = this.generateRoomCode();
    
    // Подписываемся на все сообщения в комнате
    const roomTopic = `${TOPIC_PREFIX}/${this.roomCode}`;
    this.client!.subscribe(`${roomTopic}/#`, { qos: 1 });

    // Регистрируем себя как хоста с retained message
    this.publishPlayerData();

    // Запускаем heartbeat
    this.startHeartbeat();
    this.startCleanup();

    this.notifyStatus(`Комната создана: ${this.roomCode}`);
    return this.roomCode;
  }

  // Подключиться к комнате
  async joinRoom(code: string): Promise<boolean> {
    if (!this.isConnected) {
      await this.connectToBroker();
    }

    this.isHost = false;
    this.roomCode = code.trim().toUpperCase();
    
    // Подписываемся на комнату
    const roomTopic = `${TOPIC_PREFIX}/${this.roomCode}`;
    this.client!.subscribe(`${roomTopic}/#`, { qos: 1 });

    // Регистрируем себя
    this.publishPlayerData();

    // Запускаем heartbeat
    this.startHeartbeat();
    this.startCleanup();

    // Запрашиваем список игроков у хоста
    this.client!.publish(`${roomTopic}/request_players`, JSON.stringify({
      from: this.myId,
    }));

    this.notifyStatus(`Подключено к комнате: ${this.roomCode}`);
    return true;
  }

  // Публикация данных своего игрока
  private publishPlayerData() {
    if (!this.client || !this.roomCode) return;

    const myPlayer = this.players.get(this.myId) || {
      id: this.myId,
      name: this.myName,
      x: 3200,
      y: 3200,
      direction: 'down',
      animation: 'idle',
      emotion: null,
      color: this.myColor,
      lastSeen: Date.now(),
    };

    myPlayer.lastSeen = Date.now();
    this.players.set(this.myId, myPlayer);

    const topic = `${TOPIC_PREFIX}/${this.roomCode}/players/${this.myId}`;
    this.client.publish(topic, JSON.stringify(myPlayer), {
      qos: 0,
      retain: true, // Retained message — новые подключённые сразу видят всех
    });
  }

  // Обновление позиции
  updateMyPlayer(data: Partial<PlayerData>) {
    const myPlayer = this.players.get(this.myId);
    if (!myPlayer) return;

    Object.assign(myPlayer, data);
    myPlayer.lastSeen = Date.now();
    
    this.publishPlayerData();
  }

  // Отправка сообщения в чат
  sendChat(text: string) {
    if (!this.client || !this.roomCode) return;

    const msg: ChatMessage = {
      from: this.myId,
      fromName: this.myName,
      text,
      timestamp: Date.now(),
    };

    const topic = `${TOPIC_PREFIX}/${this.roomCode}/chat`;
    this.client.publish(topic, JSON.stringify(msg), { qos: 1 });

    // Локально тоже показываем
    if (this.onChatMessage) this.onChatMessage(msg);
  }

  // Обработка входящих сообщений
  private handleMessage(topic: string, payload: string) {
    const parts = topic.split('/');
    // topic format: rpg25d_game/{roomCode}/{type}/{id?}
    
    if (parts.length < 3) return;
    const type = parts[2];

    try {
      if (type === 'players' && parts.length >= 4) {
        const playerId = parts[3];
        const data = JSON.parse(payload) as PlayerData;
        
        if (playerId !== this.myId) {
          this.players.set(playerId, data);
          this.notifyPlayersUpdate();
        }
      } else if (type === 'chat') {
        const msg = JSON.parse(payload) as ChatMessage;
        if (msg.from !== this.myId && this.onChatMessage) {
          this.onChatMessage(msg);
        }
      } else if (type === 'request_players') {
        // Кто-то запрашивает список игроков — отправляем свои данные
        this.publishPlayerData();
      } else if (type === 'player_left') {
        const data = JSON.parse(payload);
        this.players.delete(data.id);
        this.notifyPlayersUpdate();
      }
    } catch (e) {
      console.error('Error handling message:', e);
    }
  }

  // Heartbeat — подтверждаем что мы онлайн
  private startHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    
    this.heartbeatInterval = setInterval(() => {
      this.publishPlayerData();
    }, 2000); // Каждые 2 секунды
  }

  // Очистка отключившихся игроков
  private startCleanup() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let changed = false;
      
      for (const [id, player] of this.players.entries()) {
        if (id !== this.myId && now - player.lastSeen > 10000) {
          // Игрок не отвечал 10 секунд — удаляем
          this.players.delete(id);
          changed = true;
        }
      }
      
      if (changed) this.notifyPlayersUpdate();
    }, 5000);
  }

  // Отключение от комнаты
  disconnect() {
    if (this.client && this.roomCode) {
      // Уведомляем что уходим
      const topic = `${TOPIC_PREFIX}/${this.roomCode}/player_left`;
      this.client.publish(topic, JSON.stringify({ id: this.myId }), { qos: 0 });
      
      // Удаляем retained message
      const playerTopic = `${TOPIC_PREFIX}/${this.roomCode}/players/${this.myId}`;
      this.client.publish(playerTopic, '', { retain: true });
      
      // Отписываемся
      this.client.unsubscribe(`${TOPIC_PREFIX}/${this.roomCode}/#`);
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.players.clear();
    this.roomCode = '';
    this.isHost = false;
    this.notifyPlayersUpdate();
  }

  // Полное отключение от сервера
  destroy() {
    this.disconnect();
    if (this.client) {
      this.client.end(true);
      this.client = null;
    }
    this.isConnected = false;
  }

  // Генерация кода комнаты
  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  // Getters
  getPlayers(): PlayerData[] {
    return Array.from(this.players.values());
  }

  getMyId(): string { return this.myId; }
  getMyName(): string { return this.myName; }
  getMyColor(): string { return this.myColor; }
  getRoomCode(): string { return this.roomCode; }
  isInRoom(): boolean { return this.roomCode !== ''; }
  getConnected(): boolean { return this.isConnected; }
  isHostPlayer(): boolean { return this.isHost; }

  setMyName(name: string) {
    this.myName = name;
    const myPlayer = this.players.get(this.myId);
    if (myPlayer) {
      myPlayer.name = name;
      this.publishPlayerData();
    }
  }

  // Callbacks
  setOnPlayersUpdate(cb: (players: PlayerData[]) => void) { this.onPlayersUpdate = cb; }
  setOnChatMessage(cb: (msg: ChatMessage) => void) { this.onChatMessage = cb; }
  setOnStatusChange(cb: (status: string) => void) { this.onStatusChange = cb; }
  setOnConnectionChange(cb: (connected: boolean) => void) { this.onConnectionChange = cb; }

  private notifyPlayersUpdate() {
    if (this.onPlayersUpdate) this.onPlayersUpdate(this.getPlayers());
  }

  private notifyStatus(status: string) {
    console.log('[MP]', status);
    if (this.onStatusChange) this.onStatusChange(status);
  }
}
