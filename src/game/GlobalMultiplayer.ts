// Общий серверный мультиплеер — один мир для всех
// Все игроки подключаются к единому глобальному серверу автоматически

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

// Публичные MQTT broker'ы
const BROKERS = [
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://mqtt.eclipseprojects.io:443',
  'wss://test.mosquitto.org:8081',
];

// Единый глобальный топик — все игроки в одном мире
const GLOBAL_TOPIC = 'rpg25d_global_world_v1';

export class GlobalMultiplayer {
  private client: MqttClient | null = null;
  private myId: string;
  private myName: string;
  private myColor: string;
  private connected: boolean = false;
  private connecting: boolean = false;
  
  private players: Map<string, PlayerData> = new Map();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private brokerIndex: number = 0;
  private lastUpdate: number = 0;
  
  // Callbacks
  private onPlayersUpdate: ((players: PlayerData[]) => void) | null = null;
  private onChatMessage: ((msg: ChatMessage) => void) | null = null;
  private onStatusChange: ((status: string) => void) | null = null;

  constructor() {
    this.myId = this.generateId();
    this.myName = 'Игрок_' + Math.floor(Math.random() * 1000);
    this.myColor = this.getRandomColor();
  }

  private generateId(): string {
    return 'p_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }

  private getRandomColor(): string {
    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Автоподключение к общему серверу
  async connect(): Promise<boolean> {
    if (this.connected || this.connecting) return this.connected;
    this.connecting = true;

    return new Promise((resolve) => {
      this.tryConnect(resolve);
    });
  }

  private tryConnect(resolve: (ok: boolean) => void, attempts: number = 0): void {
    const brokerUrl = BROKERS[this.brokerIndex];
    this.notifyStatus(`Подключение к серверу...`);

    const client = mqtt.connect(brokerUrl, {
      clientId: this.myId,
      clean: true,
      connectTimeout: 8000,
      reconnectPeriod: 0, // Не реконнектим сами — управляем вручную
      keepalive: 30,
    });

    const timeout = setTimeout(() => {
      client.end(true);
      this.brokerIndex = (this.brokerIndex + 1) % BROKERS.length;
      if (attempts < BROKERS.length - 1) {
        this.tryConnect(resolve, attempts + 1);
      } else {
        this.connecting = false;
        this.notifyStatus('Не удалось подключиться');
        resolve(false);
      }
    }, 8000);

    client.on('connect', () => {
      clearTimeout(timeout);
      this.client = client;
      this.connected = true;
      this.connecting = false;
      this.notifyStatus('Сервер подключён ✓');

      // Подписываемся на глобальный мир
      client.subscribe(`${GLOBAL_TOPIC}/#`, { qos: 1 });

      // Регистрируем себя
      this.publishSelf();
      this.startHeartbeat();
      this.startCleanup();

      resolve(true);
    });

    client.on('error', () => {
      clearTimeout(timeout);
      client.end(true);
      this.brokerIndex = (this.brokerIndex + 1) % BROKERS.length;
      if (attempts < BROKERS.length - 1) {
        this.tryConnect(resolve, attempts + 1);
      } else {
        this.connecting = false;
        this.notifyStatus('Сервер недоступен');
        resolve(false);
      }
    });

    client.on('close', () => {
      this.connected = false;
    });

    client.on('message', (topic, message) => {
      this.handleMessage(topic, message.toString());
    });
  }

  // Публикация своих данных
  private publishSelf(): void {
    if (!this.client) return;

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

    this.client.publish(
      `${GLOBAL_TOPIC}/players/${this.myId}`,
      JSON.stringify(myPlayer),
      { qos: 0, retain: true }
    );
  }

  // Обновление позиции (с троттлингом)
  updateMyPlayer(data: Partial<PlayerData>): void {
    const myPlayer = this.players.get(this.myId);
    if (!myPlayer) return;

    Object.assign(myPlayer, data);
    myPlayer.lastSeen = Date.now();

    // Троттлинг — публикуем не чаще 10 раз в секунду
    const now = Date.now();
    if (now - this.lastUpdate < 100) return;
    this.lastUpdate = now;

    this.publishSelf();
  }

  // Чат
  sendChat(text: string): void {
    if (!this.client) return;

    const msg: ChatMessage = {
      from: this.myId,
      fromName: this.myName,
      text,
      timestamp: Date.now(),
    };

    this.client.publish(`${GLOBAL_TOPIC}/chat`, JSON.stringify(msg), { qos: 1 });
    if (this.onChatMessage) this.onChatMessage(msg);
  }

  // Обработка входящих сообщений
  private handleMessage(topic: string, payload: string): void {
    // topic: rpg25d_global_world_v1/players/{id} или rpg25d_global_world_v1/chat
    const parts = topic.split('/');
    if (parts.length < 3) return;

    try {
      if (parts[1] === 'players' && parts[2]) {
        const playerId = parts[2];
        if (playerId === this.myId) return; // Игнорируем свои данные

        if (!payload || payload.length === 0) {
          // Пустое retained = игрок вышел
          this.players.delete(playerId);
          this.notifyPlayersUpdate();
          return;
        }

        const data = JSON.parse(payload) as PlayerData;
        this.players.set(playerId, data);
        this.notifyPlayersUpdate();
      } else if (parts[1] === 'chat') {
        const msg = JSON.parse(payload) as ChatMessage;
        if (msg.from !== this.myId && this.onChatMessage) {
          this.onChatMessage(msg);
        }
      }
    } catch (e) {
      // Игнорируем ошибки парсинга
    }
  }

  // Heartbeat — каждые 2 секунды
  private startHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.publishSelf();
    }, 2000);
  }

  // Очистка отключившихся
  private startCleanup(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, player] of this.players.entries()) {
        if (id !== this.myId && now - player.lastSeen > 15000) {
          this.players.delete(id);
          changed = true;
        }
      }
      if (changed) this.notifyPlayersUpdate();
    }, 3000);
  }

  // Отключение (при закрытии страницы)
  disconnect(): void {
    if (this.client) {
      // Очищаем retained message
      this.client.publish(`${GLOBAL_TOPIC}/players/${this.myId}`, '', { retain: true });
      this.client.end(true);
      this.client = null;
    }
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
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
    const myPlayer = this.players.get(this.myId);
    if (myPlayer) {
      myPlayer.name = name;
      this.publishSelf();
    }
  }

  // Callbacks
  setOnPlayersUpdate(cb: (players: PlayerData[]) => void) { this.onPlayersUpdate = cb; }
  setOnChatMessage(cb: (msg: ChatMessage) => void) { this.onChatMessage = cb; }
  setOnStatusChange(cb: (status: string) => void) { this.onStatusChange = cb; }

  private notifyPlayersUpdate(): void {
    if (this.onPlayersUpdate) this.onPlayersUpdate(this.getPlayers());
  }

  private notifyStatus(status: string): void {
    console.log('[Server]', status);
    if (this.onStatusChange) this.onStatusChange(status);
  }
}
