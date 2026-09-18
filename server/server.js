// ============================================
// 🎮 Сервер мультиплеера для 2.5D RPG
// ============================================
// Node.js + Socket.io
// Деплой: Render.com или Railway.app
// ============================================

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// CORS для подключения с любого домена
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Хранилище игроков
const players = new Map();

// Rate limiting для защиты от спама
const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 1000; // 1 секунда
const MAX_REQUESTS_PER_WINDOW = 30; // Максимум 30 запросов в секунду

// Проверка rate limit
function checkRateLimit(socketId) {
  const now = Date.now();
  let clientData = rateLimits.get(socketId);
  
  if (!clientData || now - clientData.windowStart > RATE_LIMIT_WINDOW) {
    // Новый временной интервал
    clientData = { windowStart: now, count: 0 };
    rateLimits.set(socketId, clientData);
  }
  
  clientData.count++;
  return clientData.count <= MAX_REQUESTS_PER_WINDOW;
}

// Валидация данных игрока
function validatePlayerData(data) {
  if (!data || typeof data !== 'object') return false;
  
  // Проверка координат (разумные значения)
  if (typeof data.x !== 'number' || typeof data.y !== 'number') return false;
  if (data.x < 0 || data.y < 0 || data.x > 10000 || data.y > 10000) return false;
  
  // Проверка направления
  const validDirections = ['up', 'down', 'left', 'right'];
  if (data.direction && !validDirections.includes(data.direction)) return false;
  
  // Проверка анимации
  const validAnimations = ['idle', 'walk', 'run', 'jump', 'emotion'];
  if (data.animation && !validAnimations.includes(data.animation)) return false;
  
  // Проверка имени (если есть)
  if (data.name && (typeof data.name !== 'string' || data.name.length > 20)) return false;
  
  return true;
}

// ============================================
// Обработка подключений
// ============================================
io.on('connection', (socket) => {
  console.log(`✅ Игрок подключился: ${socket.id}`);

  // Игрок вошёл в игру
  socket.on('player:join', (data) => {
    // Проверка rate limit
    if (!checkRateLimit(socket.id)) {
      console.warn(`⚠️ Rate limit превышен для ${socket.id}`);
      return;
    }
    
    // Валидация данных
    if (!validatePlayerData(data)) {
      console.warn(`⚠️ Неверные данные при подключении от ${socket.id}`);
      return;
    }
    
    const player = {
      id: socket.id,
      name: data.name,
      x: data.x || 3200,
      y: data.y || 3200,
      direction: data.direction || 'down',
      animation: data.animation || 'idle',
      emotion: data.emotion || null,
      color: data.color || '#3B82F6'
    };

    players.set(socket.id, player);

    // Отправляем новому игроку список всех игроков
    socket.emit('players:list', Array.from(players.values()));

    // Уведомляем остальных о новом игроке
    socket.broadcast.emit('player:joined', player);

    console.log(`🎮 ${player.name} вошёл в игру. Всего игроков: ${players.size}`);
  });

  // Игрок обновил позицию
  socket.on('player:update', (data) => {
    // Проверка rate limit
    if (!checkRateLimit(socket.id)) {
      return; // Тихо игнорируем превышение rate limit
    }
    
    // Валидация данных
    if (!validatePlayerData(data)) {
      console.warn(`⚠️ Неверные данные обновления от ${socket.id}`);
      return;
    }
    
    const player = players.get(socket.id);
    if (!player) return;

    // Обновляем только проверенные данные
    player.x = data.x;
    player.y = data.y;
    player.direction = data.direction;
    player.animation = data.animation;
    player.emotion = data.emotion;

    // Рассылаем обновление всем КРОМЕ отправителя
    socket.broadcast.emit('player:moved', player);
  });

  // Игрок отправил сообщение в чат
  socket.on('chat:message', (data) => {
    const player = players.get(socket.id);
    if (!player) return;

    const message = {
      from: socket.id,
      fromName: player.name,
      text: data.text,
      timestamp: Date.now()
    };

    // Рассылаем всем
    io.emit('chat:message', message);
  });

  // Игрок отключился
  socket.on('disconnect', () => {
    const player = players.get(socket.id);
    if (player) {
      console.log(`👋 ${player.name} вышел из игры`);
      players.delete(socket.id);
      io.emit('player:left', { id: socket.id });
      console.log(`Всего игроков: ${players.size}`);
    }
  });
});

// ============================================
// HTTP endpoints для мониторинга
// ============================================
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    players: players.size,
    uptime: process.uptime()
  });
});

app.get('/players', (req, res) => {
  res.json(Array.from(players.values()));
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
  console.log('║  ✅ Сервер запущен и готов к подключениям ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
});
