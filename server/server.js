// ============================================
// 🎮 2.5D RPG Multiplayer Server (Socket.io)
// ============================================
// Сервер для синхронизации игроков в реальном времени
// Деплой: Railway / Render / Fly.io (бесплатно)
// ============================================

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);

// ============================================
// Конфигурация CORS
// ============================================
const ALLOWED_ORIGINS = [
  'https://ramiros.netlify.app',
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.CORS_ORIGIN || ''
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
});

// ============================================
// Middleware
// ============================================
app.use(compression());
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

// Rate limiting для HTTP endpoints
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100 // 100 запросов
});
app.use(limiter);

// ============================================
// Хранилище игроков
// ============================================
const players = new Map();

// Rate limiting для WebSocket сообщений (на клиента)
const clientMessageCounts = new Map();
const MESSAGE_LIMIT = 60; // 60 сообщений в секунду
const MESSAGE_WINDOW = 1000; // 1 секунда

function checkRateLimit(socketId) {
  const now = Date.now();
  const data = clientMessageCounts.get(socketId) || { count: 0, windowStart: now };
  
  if (now - data.windowStart > MESSAGE_WINDOW) {
    data.count = 0;
    data.windowStart = now;
  }
  
  data.count++;
  clientMessageCounts.set(socketId, data);
  
  return data.count <= MESSAGE_LIMIT;
}

// ============================================
// Валидация данных
// ============================================
function validatePlayerData(data) {
  if (!data || typeof data !== 'object') return false;
  
  // Проверка координат (карта 100x100 тайлов по 64px = 6400x6400)
  if (typeof data.x !== 'number' || data.x < 0 || data.x > 6400) return false;
  if (typeof data.y !== 'number' || data.y < 0 || data.y > 6400) return false;
  
  // Проверка направления
  const validDirections = ['up', 'down', 'left', 'right'];
  if (data.direction && !validDirections.includes(data.direction)) return false;
  
  // Проверка анимации
  const validAnimations = ['idle', 'walk', 'run', 'jump', 'emotion'];
  if (data.animation && !validAnimations.includes(data.animation)) return false;
  
  return true;
}

// ============================================
// Socket.io обработка подключений
// ============================================
io.on('connection', (socket) => {
  console.log(`✅ Игрок подключился: ${socket.id}`);
  console.log(`👥 Всего игроков: ${players.size + 1}`);

  // ============================================
  // Обработка входа игрока
  // ============================================
  socket.on('player:join', (data) => {
    if (!data || !data.name) {
      socket.emit('error', { message: 'Имя обязательно' });
      return;
    }

    // Создаём игрока
    const player = {
      id: socket.id,
      name: String(data.name).substring(0, 20), // Макс 20 символов
      x: typeof data.x === 'number' ? data.x : 3200,
      y: typeof data.y === 'number' ? data.y : 3200,
      direction: data.direction || 'down',
      animation: data.animation || 'idle',
      emotion: data.emotion || null,
      color: data.color || getRandomColor(),
      joinedAt: Date.now()
    };

    players.set(socket.id, player);

    // Отправляем новому игроку список всех игроков
    socket.emit('players:list', getPlayersList(socket.id));

    // Уведомляем остальных о новом игроке
    socket.broadcast.emit('player:joined', player);

    // Уведомление в чат
    io.emit('chat:system', {
      text: `${player.name} присоединился к игре`,
      timestamp: Date.now()
    });

    console.log(`🎮 ${player.name} (${socket.id}) вошёл в игру`);
  });

  // ============================================
  // Обработка обновления позиции
  // ============================================
  socket.on('player:update', (data) => {
    // Rate limiting
    if (!checkRateLimit(socket.id)) {
      return; // Игнорируем если превышен лимит
    }

    // Валидация
    if (!validatePlayerData(data)) {
      return;
    }

    const player = players.get(socket.id);
    if (!player) return;

    // Обновляем данные игрока
    player.x = data.x;
    player.y = data.y;
    if (data.direction) player.direction = data.direction;
    if (data.animation) player.animation = data.animation;
    if (data.emotion !== undefined) player.emotion = data.emotion;

    // Рассылаем обновление всем КРОМЕ отправителя
    socket.broadcast.emit('player:moved', {
      id: socket.id,
      x: player.x,
      y: player.y,
      direction: player.direction,
      animation: player.animation,
      emotion: player.emotion
    });
  });

  // ============================================
  // Обработка чата
  // ============================================
  socket.on('chat:message', (data) => {
    if (!data || !data.text) return;
    
    const player = players.get(socket.id);
    if (!player) return;

    // Rate limiting для чата
    if (!checkRateLimit(socket.id)) return;

    const message = {
      from: socket.id,
      fromName: player.name,
      text: String(data.text).substring(0, 200), // Макс 200 символов
      timestamp: Date.now()
    };

    // Рассылаем всем включая отправителя
    io.emit('chat:message', message);
  });

  // ============================================
  // Обработка смены имени
  // ============================================
  socket.on('player:rename', (data) => {
    if (!data || !data.name) return;
    
    const player = players.get(socket.id);
    if (!player) return;

    const oldName = player.name;
    player.name = String(data.name).substring(0, 20);

    // Уведомляем всех
    io.emit('player:renamed', {
      id: socket.id,
      oldName,
      newName: player.name
    });
  });

  // ============================================
  // Обработка отключения
  // ============================================
  socket.on('disconnect', (reason) => {
    const player = players.get(socket.id);
    
    if (player) {
      console.log(`👋 ${player.name} (${socket.id}) отключился: ${reason}`);
      
      players.delete(socket.id);
      clientMessageCounts.delete(socket.id);

      // Уведомляем остальных
      io.emit('player:left', { id: socket.id });

      // Системное сообщение
      io.emit('chat:system', {
        text: `${player.name} покинул игру`,
        timestamp: Date.now()
      });
    } else {
      console.log(`❌ Неизвестный игрок отключился: ${socket.id}`);
    }

    console.log(`👥 Всего игроков: ${players.size}`);
  });

  // ============================================
  // Обработка ошибок
  // ============================================
  socket.on('error', (error) => {
    console.error(`⚠️ Ошибка сокета ${socket.id}:`, error);
  });
});

// ============================================
// Вспомогательные функции
// ============================================
function getPlayersList(excludeId) {
  const list = [];
  players.forEach((player, id) => {
    if (id !== excludeId) {
      list.push(player);
    }
  });
  return list;
}

function getRandomColor() {
  const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// ============================================
// HTTP Endpoints (для мониторинга)
// ============================================
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    players: players.size,
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

app.get('/players', (req, res) => {
  const list = [];
  players.forEach((player) => {
    list.push({
      id: player.id,
      name: player.name,
      color: player.color,
      joinedAt: player.joinedAt
    });
  });
  res.json(list);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ============================================
// Запуск сервера
// ============================================
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  🎮 2.5D RPG Multiplayer Server          ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  📡 Порт: ${PORT}                           ║`);
  console.log(`║  🌐 Режим: ${process.env.NODE_ENV || 'development'}               ║`);
  console.log('║  ✅ Сервер запущен и готов к подключениям ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
});

// ============================================
// Graceful shutdown
// ============================================
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM получен, закрываем сервер...');
  server.close(() => {
    console.log('✅ Сервер закрыт');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT получен, закрываем сервер...');
  server.close(() => {
    console.log('✅ Сервер закрыт');
    process.exit(0);
  });
});
