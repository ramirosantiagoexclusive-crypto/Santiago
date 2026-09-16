// Простой WebSocket сервер для мультиплеера
// Задеплойте на Railway/Render бесплатно

import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: Number(PORT) });

interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  direction: string;
  animation: string;
  emotion: string | null;
  color: string;
  ws: any;
}

const players = new Map<string, Player>();

console.log(`🎮 RPG Multiplayer Server starting on port ${PORT}...`);

wss.on('connection', (ws) => {
  console.log('✅ New player connected');
  
  let playerId = '';

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'join':
          playerId = data.id;
          players.set(playerId, {
            id: data.id,
            name: data.name,
            x: data.x || 3200,
            y: data.y || 3200,
            direction: data.direction || 'down',
            animation: data.animation || 'idle',
            emotion: data.emotion || null,
            color: data.color || '#FFFFFF',
            ws
          });
          
          console.log(`👤 Player joined: ${data.name} (${playerId})`);
          
          // Отправляем список всех игроков новому игроку
          ws.send(JSON.stringify({
            type: 'players_list',
            players: Array.from(players.values()).map(p => ({
              id: p.id,
              name: p.name,
              x: p.x,
              y: p.y,
              direction: p.direction,
              animation: p.animation,
              emotion: p.emotion,
              color: p.color
            }))
          }));
          
          // Уведомляем остальных о новом игроке
          broadcast({
            type: 'player_joined',
            player: {
              id: playerId,
              name: data.name,
              x: data.x || 3200,
              y: data.y || 3200,
              direction: data.direction || 'down',
              animation: data.animation || 'idle',
              emotion: data.emotion || null,
              color: data.color || '#FFFFFF'
            }
          }, playerId);
          break;

        case 'update':
          const player = players.get(playerId);
          if (player) {
            player.x = data.x;
            player.y = data.y;
            player.direction = data.direction;
            player.animation = data.animation;
            player.emotion = data.emotion;
            
            // Отправляем обновление всем кроме отправителя
            broadcast({
              type: 'player_update',
              player: {
                id: playerId,
                x: data.x,
                y: data.y,
                direction: data.direction,
                animation: data.animation,
                emotion: data.emotion
              }
            }, playerId);
          }
          break;

        case 'chat':
          broadcast({
            type: 'chat',
            from: playerId,
            fromName: data.fromName,
            text: data.text,
            timestamp: data.timestamp
          });
          break;

        case 'leave':
          handleDisconnect(playerId);
          break;
      }
    } catch (err) {
      console.error('Error processing message:', err);
    }
  });

  ws.on('close', () => {
    handleDisconnect(playerId);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    handleDisconnect(playerId);
  });
});

function broadcast(data: any, excludeId?: string) {
  const message = JSON.stringify(data);
  players.forEach((player, id) => {
    if (id !== excludeId && player.ws.readyState === 1) {
      player.ws.send(message);
    }
  });
}

function handleDisconnect(playerId: string) {
  if (playerId && players.has(playerId)) {
    const player = players.get(playerId);
    console.log(`👋 Player disconnected: ${player?.name} (${playerId})`);
    
    players.delete(playerId);
    
    broadcast({
      type: 'player_left',
      id: playerId
    });
  }
}

console.log(`✅ Server is running on port ${PORT}`);
console.log(`📡 WebSocket URL: ws://localhost:${PORT}`);
