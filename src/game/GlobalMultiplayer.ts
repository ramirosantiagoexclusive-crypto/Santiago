// Общий серверный мультиплеер — один мир для всех
// Все игроки подключаются к единому глобальному серверу автоматически

// Динамический импорт MQTT для быстрой загрузки игры
type MqttClient = any;
let mqttModule: any = null;

async function loadMqtt(): Promise<any> {
  if (!mqttModule) {
    mqttModule = await import('mqtt');
  }
  return mqttModule;
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
  lastSeen: number;
}

export interface ChatMessage {
  from: string;
  fromName: string;
  text: string;
  timestamp: number;
}

// Публичные MQTT broker'ы (множество вариантов для надёжности)
const BROKERS = [
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://mqtt.eclipseprojects.io:443',
  'wss://test.mosquitto.org:8081',
  'wss://broker.emqx.io:8084/mqtt',
  'wss://public.mqtthq.com:8084/mqtt',
  'wss://mqtt.cesiumtech.com:443',
  'wss://broker.thingsboard.io:443',
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
  private onConnectionChange: ((connected: boolean) => void) | null = null;

  constructor() {
    this.myId = this.generateId();
    this.myName = 'Игрок_' + Math.floor(Math.random() * 1000);
    this.myColor = this.getRandomColor();
  }

  private generateId(): string {
    // Уникальный ID с учётом случайности и времени
    const rand = Math.random().toString(36).substring(2, 15);
    const rand2 = Math.random().toString(36).substring(2, 15);
    return 'rpg25d_' + Date.now().toString(36) + '_' + rand + rand2;
  }

  private getRandomColor(): string {
    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Автоподключение к общему серверу (неблокирующее)
  connect(): void {
    if (this.connected || this.connecting) return;
    this.connecting = true;
    console.log('[Multiplayer] Инициализация подключения к серверу...');
    console.log('[Multiplayer] Доступные брокеры:', BROKERS);
    this.tryConnectBackground();
  }

  // Подключение в фоне — не блокирует UI
  private tryConnectBackground(): void {
    // Используем setTimeout чтобы не блокировать рендер игры
    setTimeout(async () => {
      await this.doConnect(0);
    }, 100);
  }

  private async doConnect(attempt: number = 0): Promise<void> {
    // Ограничиваем количество попыток
    if (attempt >= BROKERS.length * 3) {
      this.notifyStatus('Сервер недоступен. Играйте в одиночном режиме.');
      this.connecting = false;
      if (this.onConnectionChange) this.onConnectionChange(false);
      console.log('[Multiplayer] Все попытки подключения исчерпаны');
      return;
    }

    const brokerUrl = BROKERS[this.brokerIndex];
    this.notifyStatus(`Подключение... (${attempt + 1}/${BROKERS.length * 3})`);
    console.log(`[Multiplayer] Попытка ${attempt + 1}: ${brokerUrl}`);

    try {
      // Динамическая загрузка MQTT
      const mqtt = await loadMqtt();
      
      const client = mqtt.connect(brokerUrl, {
        clientId: this.myId,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 0, // Отключаем автоматический реконнект
        keepalive: 20,
        rejectUnauthorized: false,
      });

      const timeout = setTimeout(() => {
        console.log(`[Multiplayer] Таймаут подключения к ${brokerUrl}`);
        this.notifyStatus('Таймаут, следующий сервер...');
        client.end(true);
        this.brokerIndex = (this.brokerIndex + 1) % BROKERS.length;
        setTimeout(() => this.doConnect(attempt + 1), 2000);
      }, 5000);

      client.on('connect', () => {
        clearTimeout(timeout);
        console.log(`[Multiplayer] ✓ Успешно подключено к ${brokerUrl}`);
        this.client = client;
        this.connected = true;
        this.connecting = false;
        this.notifyStatus('Сервер подключён ✓');
        if (this.onConnectionChange) this.onConnectionChange(true);

        client.subscribe(`${GLOBAL_TOPIC}/#`, { qos: 1 });
        this.publishSelf();
        this.startHeartbeat();
        this.startCleanup();
      });

      // Обработка потери соединения
      client.on('offline', () => {
        this.connected = false;
        this.notifyStatus('Соединение потеряно');
        if (this.onConnectionChange) this.onConnectionChange(false);
      });

      client.on('error', (err: any) => {
        clearTimeout(timeout);
        console.warn(`[Multiplayer] Ошибка подключения к ${brokerUrl}:`, err.message || err);
        client.end(true);
        this.brokerIndex = (this.brokerIndex + 1) % BROKERS.length;
        setTimeout(() => this.doConnect(attempt + 1), 2000);
      });

      client.on('close', () => {
        console.log(`[Multiplayer] Соединение закрыто: ${brokerUrl}`);
        this.connected = false;
        if (this.onConnectionChange) this.onConnectionChange(false);
      });

      client.on('reconnect', () => {
        this.notifyStatus('Переподключение...');
      });

      client.on('message', (topic: string, message: any) => {
        this.handleMessage(topic, message.toString());
      });
    } catch (e) {
      console.error(`[Multiplayer] Критическая ошибка подключения:`, e);
      this.brokerIndex = (this.brokerIndex + 1) % BROKERS.length;
      setTimeout(() => this.doConnect(attempt + 1), 2000);
    }
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
  setOnConnectionChange(cb: (connected: boolean) => void) { this.onConnectionChange = cb; }

  private notifyPlayersUpdate(): void {
    if (this.onPlayersUpdate) this.onPlayersUpdate(this.getPlayers());
  }

  private notifyStatus(status: string): void {
    console.log('[Server]', status);
    if (this.onStatusChange) this.onStatusChange(status);
  }
}
