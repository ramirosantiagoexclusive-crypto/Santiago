// Основной игровой движок 2.5D RPG
import { generateSpriteSheet, FRAME_SIZE, Direction, AnimationType, Emotion } from './SpriteGenerator';
import { generateMap, generateTileTextures, TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, TileType, isWalkable } from './MapGenerator';

// Интерфейс состояния игрока
interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  direction: Direction;
  animation: AnimationType;
  emotion: Emotion | null;
  frameIndex: number;
  frameTimer: number;
  isJumping: boolean;
  jumpHeight: number;
  jumpVelocity: number;
  isRunning: boolean;
  bobOffset: number;
}

// Интерфейс частицы
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
  type?: 'normal' | 'shockwave';
}

// Интерфейс камеры
interface Camera {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
}

// Скорости
const WALK_SPEED = 2.5;
const RUN_SPEED = 4.5;
const ACCELERATION = 0.3;
const DECELERATION = 0.85;
const JUMP_FORCE = -10; // Усиленный прыжок
const GRAVITY = 0.5;
const CAMERA_LERP = 0.08;

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private spriteSheet: HTMLCanvasElement | null = null;
  private tileTextures: Map<TileType, HTMLCanvasElement> = new Map();
  private map: TileType[][] = [];
  private player: PlayerState;
  private camera: Camera;
  private particles: Particle[] = [];
  private keys: Set<string> = new Set();
  private animationId: number = 0;
  private lastTime: number = 0;
  private gameTime: number = 0;
  private onStateChange: ((state: GameState) => void) | null = null;
  private waterAnimOffset: number = 0;
  private otherPlayers: Array<{
    id: string;
    name: string;
    x: number;
    y: number;
    direction: Direction;
    animation: AnimationType;
    emotion: Emotion | null;
    color: string;
  }> = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    
    // Инициализация игрока в центре карты
    this.player = {
      x: MAP_WIDTH * TILE_SIZE / 2,
      y: MAP_HEIGHT * TILE_SIZE / 2,
      vx: 0,
      vy: 0,
      direction: 'down',
      animation: 'idle',
      emotion: null,
      frameIndex: 0,
      frameTimer: 0,
      isJumping: false,
      jumpHeight: 0,
      jumpVelocity: 0,
      isRunning: false,
      bobOffset: 0,
    };

    this.camera = {
      x: this.player.x,
      y: this.player.y,
      targetX: this.player.x,
      targetY: this.player.y,
    };

    this.setupInput();
  }

  // Инициализация ресурсов
  async init(): Promise<void> {
    // Генерируем спрайт-лист
    const spriteData = generateSpriteSheet();
    this.spriteSheet = spriteData.canvas;

    // Генерируем текстуры тайлов
    this.tileTextures = generateTileTextures();

    // Генерируем карту
    this.map = generateMap(42);

    // Запускаем игровой цикл
    this.lastTime = performance.now();
    this.gameLoop();
  }

  // Настройка ввода
  private setupInput(): void {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
      
      // Эмоции по цифрам
      const emotionKeys: { [key: string]: Emotion } = {
        '1': 'happy',
        '2': 'sad',
        '3': 'angry',
        '4': 'surprised',
        '5': 'love',
        '6': 'wink',
      };
      
      if (emotionKeys[e.key]) {
        this.player.emotion = emotionKeys[e.key];
        this.player.animation = 'emotion';
        this.player.frameIndex = 0;
        this.player.frameTimer = 0;
      }

      // Прыжок
      if (e.key === ' ' && !this.player.isJumping) {
        this.player.isJumping = true;
        this.player.jumpVelocity = JUMP_FORCE;
        this.player.animation = 'jump';
        this.player.frameIndex = 0;
        // Частицы при прыжке
        this.spawnJumpParticles();
      }

      // Сброс эмоции при движении
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
        if (this.player.emotion) {
          this.player.emotion = null;
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
  }

  // Установить эмоцию (для UI кнопок)
  setEmotion(emotion: Emotion | null): void {
    this.player.emotion = emotion;
    if (emotion) {
      this.player.animation = 'emotion';
      this.player.frameIndex = 0;
      this.player.frameTimer = 0;
    }
  }

  // Внешнее управление (для виртуального джойстика)
  setExternalInput(x: number, y: number): void {
    // Преобразуем нормализованные значения (-1 до 1) в нажатия клавиш
    const threshold = 0.3;
    
    if (Math.abs(x) > threshold || Math.abs(y) > threshold) {
      // Очищаем существующие "виртуальные" клавиши
      this.keys.delete('w');
      this.keys.delete('a');
      this.keys.delete('s');
      this.keys.delete('d');
      
      if (y < -threshold) this.keys.add('w');
      if (y > threshold) this.keys.add('s');
      if (x < -threshold) this.keys.add('a');
      if (x > threshold) this.keys.add('d');
    } else {
      this.keys.delete('w');
      this.keys.delete('a');
      this.keys.delete('s');
      this.keys.delete('d');
    }
  }

  clearExternalInput(): void {
    this.keys.delete('w');
    this.keys.delete('a');
    this.keys.delete('s');
    this.keys.delete('d');
  }

  setRunning(running: boolean): void {
    if (running) {
      this.keys.add('shift');
    } else {
      this.keys.delete('shift');
    }
  }

  doJump(): void {
    if (!this.player.isJumping) {
      this.player.isJumping = true;
      this.player.jumpVelocity = JUMP_FORCE;
      this.player.animation = 'jump';
      this.player.frameIndex = 0;
      this.spawnJumpParticles();
    }
  }

  // Установить список других игроков (для мультиплеера)
  setOtherPlayers(players: Array<{
    id: string;
    name: string;
    x: number;
    y: number;
    direction: Direction;
    animation: AnimationType;
    emotion: Emotion | null;
    color: string;
  }>): void {
    this.otherPlayers = players;
  }

  // Рендеринг другого игрока
  private renderOtherPlayer(ctx: CanvasRenderingContext2D, otherPlayer: typeof this.otherPlayers[0]): void {
    if (!this.spriteSheet) return;

    // Определяем кадр
    let frameRow = 0;
    if (otherPlayer.animation === 'idle') {
      const dirOffset = { down: 0, up: 4, left: 8, right: 12 }[otherPlayer.direction];
      frameRow = dirOffset;
    } else if (otherPlayer.animation === 'walk') {
      const dirOffset = { down: 16, up: 22, left: 28, right: 34 }[otherPlayer.direction];
      frameRow = dirOffset + Math.floor(this.gameTime * 8) % 6;
    } else if (otherPlayer.animation === 'run') {
      const dirOffset = { down: 40, up: 46, left: 52, right: 58 }[otherPlayer.direction];
      frameRow = dirOffset + Math.floor(this.gameTime * 12) % 6;
    }

    const drawX = otherPlayer.x - FRAME_SIZE / 2;
    const drawY = otherPlayer.y - FRAME_SIZE / 2;

    // Тень
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(otherPlayer.x, otherPlayer.y + 28, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Спрайт
    ctx.drawImage(
      this.spriteSheet,
      0, frameRow * FRAME_SIZE, FRAME_SIZE, FRAME_SIZE,
      drawX, drawY, FRAME_SIZE, FRAME_SIZE
    );

    // Имя над игроком
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(otherPlayer.x - 30, otherPlayer.y - 48, 60, 16);
    ctx.fillStyle = otherPlayer.color || '#FFFFFF';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(otherPlayer.name, otherPlayer.x, otherPlayer.y - 36);
    ctx.textAlign = 'left';
  }

  // Основной игровой цикл
  private gameLoop = (): void => {
    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    this.gameTime += deltaTime;

    this.update(deltaTime);
    this.render();

    this.animationId = requestAnimationFrame(this.gameLoop);
  };

  // Обновление состояния
  private update(dt: number): void {
    this.updatePlayer(dt);
    this.updateCamera();
    this.updateParticles(dt);
    this.waterAnimOffset = (this.waterAnimOffset + dt * 2) % (Math.PI * 2);
  }

  private updatePlayer(dt: number): void {
    const player = this.player;
    
    // Определяем направление движения
    let inputX = 0;
    let inputY = 0;

    if (this.keys.has('w') || this.keys.has('arrowup')) inputY -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) inputY += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) inputX -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) inputX += 1;

    // Нормализация диагонального движения
    if (inputX !== 0 && inputY !== 0) {
      const len = Math.sqrt(inputX * inputX + inputY * inputY);
      inputX /= len;
      inputY /= len;
    }

    // Определяем бег
    player.isRunning = this.keys.has('shift');
    const speed = player.isRunning ? RUN_SPEED : WALK_SPEED;

    // Ускорение/торможение
    if (inputX !== 0 || inputY !== 0) {
      // Во время прыжка применяем инерцию, но не меняем направление резко
      const moveMultiplier = player.isJumping ? 0.3 : 1;
      
      player.vx += inputX * ACCELERATION * moveMultiplier;
      player.vy += inputY * ACCELERATION * moveMultiplier;
      
      // Ограничение скорости
      const currentSpeed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
      if (currentSpeed > speed) {
        player.vx = (player.vx / currentSpeed) * speed;
        player.vy = (player.vy / currentSpeed) * speed;
      }

      // Определяем направление (только если не прыгаем)
      if (!player.isJumping) {
        const oldDir = player.direction;
        if (Math.abs(inputX) > Math.abs(inputY)) {
          player.direction = inputX > 0 ? 'right' : 'left';
        } else {
          player.direction = inputY > 0 ? 'down' : 'up';
        }
        // Отладка: выводим изменение направления
        if (oldDir !== player.direction) {
          console.log('Direction changed:', oldDir, '->', player.direction);
        }
      }

      // Анимация (прыжок имеет приоритет)
      if (player.isJumping) {
        player.animation = 'jump';
        // Обновляем кадр прыжка в зависимости от высоты
        if (player.jumpVelocity < -4) {
          player.frameIndex = 1; // Взлёт
        } else if (player.jumpVelocity < 0) {
          player.frameIndex = 2; // Пик
        } else {
          player.frameIndex = 3; // Приземление
        }
      } else if (!player.emotion) {
        player.animation = player.isRunning ? 'run' : 'walk';
      }

      // Покачивание при ходьбе (только если не прыгаем)
      if (!player.isJumping) {
        player.bobOffset += dt * (player.isRunning ? 12 : 8);
      }

      // Частицы пыли при беге (только если не прыгаем)
      if (player.isRunning && !player.isJumping && Math.random() < 0.3) {
        this.spawnDustParticle();
      }
    } else {
      // Торможение (во время прыжка торможение меньше - инерция)
      const decel = player.isJumping ? 0.98 : DECELERATION;
      player.vx *= decel;
      player.vy *= decel;

      if (Math.abs(player.vx) < 0.1) player.vx = 0;
      if (Math.abs(player.vy) < 0.1) player.vy = 0;

      // Анимация (прыжок имеет приоритет)
      if (player.isJumping) {
        player.animation = 'jump';
        if (player.jumpVelocity < -4) {
          player.frameIndex = 1;
        } else if (player.jumpVelocity < 0) {
          player.frameIndex = 2;
        } else {
          player.frameIndex = 3;
        }
      } else if (!player.emotion) {
        player.animation = 'idle';
      }
    }

    // Обновление позиции (всегда, включая прыжок)
    const newX = player.x + player.vx;
    const newY = player.y + player.vy;

    // Проверка столкновений
    const tileX = Math.floor(newX / TILE_SIZE);
    const tileY = Math.floor(newY / TILE_SIZE);

    if (tileX >= 0 && tileX < MAP_WIDTH && tileY >= 0 && tileY < MAP_HEIGHT) {
      if (isWalkable(this.map[tileY][tileX])) {
        player.x = newX;
        player.y = newY;
      } else {
        // Пробуем двигаться по осям отдельно
        const tileXOnly = Math.floor(newX / TILE_SIZE);
        const tileYOnly = Math.floor(player.y / TILE_SIZE);
        if (tileXOnly >= 0 && tileXOnly < MAP_WIDTH && isWalkable(this.map[tileYOnly][tileXOnly])) {
          player.x = newX;
        }
        
        const tileXOnly2 = Math.floor(player.x / TILE_SIZE);
        const tileYOnly2 = Math.floor(newY / TILE_SIZE);
        if (tileYOnly2 >= 0 && tileYOnly2 < MAP_HEIGHT && isWalkable(this.map[tileYOnly2][tileXOnly2])) {
          player.y = newY;
        }
      }
    }

    // Границы карты
    player.x = Math.max(TILE_SIZE, Math.min(player.x, (MAP_WIDTH - 1) * TILE_SIZE));
    player.y = Math.max(TILE_SIZE, Math.min(player.y, (MAP_HEIGHT - 1) * TILE_SIZE));

    // Прыжок (физика)
    if (player.isJumping) {
      player.jumpVelocity += GRAVITY;
      player.jumpHeight += player.jumpVelocity;

      if (player.jumpHeight >= 0) {
        player.jumpHeight = 0;
        player.jumpVelocity = 0;
        player.isJumping = false;
        player.animation = 'idle';
        player.frameIndex = 0;
        // Частицы при приземлении
        this.spawnJumpParticles();
      }
    }

    // Обновление анимации
    player.frameTimer += dt;
    const frameSpeed = player.animation === 'run' ? 0.08 : 
                       player.animation === 'walk' ? 0.12 : 
                       player.animation === 'emotion' ? 0.2 : 0.25;
    
    if (player.frameTimer >= frameSpeed) {
      player.frameTimer = 0;
      player.frameIndex++;

      // Циклический переход кадров
      let maxFrames = 4;
      if (player.animation === 'walk' || player.animation === 'run') maxFrames = 6;
      if (player.animation === 'emotion') maxFrames = 3;

      if (player.frameIndex >= maxFrames) {
        player.frameIndex = 0;
        // Если эмоция закончилась, возвращаемся к idle
        if (player.animation === 'emotion') {
          player.emotion = null;
          player.animation = 'idle';
        }
      }
    }

    // Уведомляем об изменении состояния
    if (this.onStateChange) {
      this.onStateChange(this.getGameState());
    }
  }

  private updateCamera(): void {
    // Плавное следование за игроком
    this.camera.targetX = this.player.x;
    this.camera.targetY = this.player.y;
    
    this.camera.x += (this.camera.targetX - this.camera.x) * CAMERA_LERP;
    this.camera.y += (this.camera.targetY - this.camera.y) * CAMERA_LERP;

    // Ограничения камеры
    const halfW = this.canvas.width / 2;
    const halfH = this.canvas.height / 2;
    const mapPixelW = MAP_WIDTH * TILE_SIZE;
    const mapPixelH = MAP_HEIGHT * TILE_SIZE;

    this.camera.x = Math.max(halfW, Math.min(this.camera.x, mapPixelW - halfW));
    this.camera.y = Math.max(halfH, Math.min(this.camera.y, mapPixelH - halfH));
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1; // Гравитация
      p.life -= dt;
      p.alpha = p.life / p.maxLife;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  private spawnDustParticle(): void {
    this.particles.push({
      x: this.player.x + (Math.random() - 0.5) * 10,
      y: this.player.y + 20,
      vx: (Math.random() - 0.5) * 2,
      vy: -Math.random() * 2,
      life: 0.5,
      maxLife: 0.5,
      size: 2 + Math.random() * 3,
      color: '#D4A574',
      alpha: 1,
    });
  }

  private spawnJumpParticles(): void {
    // Больше частиц при прыжке
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const speed = 3 + Math.random() * 3;
      this.particles.push({
        x: this.player.x,
        y: this.player.y + 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        life: 0.8,
        maxLife: 0.8,
        size: 3 + Math.random() * 3,
        color: i % 2 === 0 ? '#A78BFA' : '#60A5FA',
        alpha: 1,
        type: 'normal',
      });
    }
    
    // Shockwave при приземлении (если прыгали)
    if (this.player.jumpHeight < -5) {
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        this.particles.push({
          x: this.player.x,
          y: this.player.y + 28,
          vx: Math.cos(angle) * 5,
          vy: Math.sin(angle) * 1,
          life: 0.5,
          maxLife: 0.5,
          size: 4,
          color: '#FCD34D',
          alpha: 1,
          type: 'shockwave',
        });
      }
    }
  }

  // Рендеринг
  private render(): void {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Градиентный фон с параллаксом
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.5, '#1e293b');
    bgGrad.addColorStop(1, '#334155');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Параллакс - дальние звёзды/облака
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    const parallaxX = -this.camera.x * 0.05;
    const parallaxY = -this.camera.y * 0.05;
    for (let i = 0; i < 20; i++) {
      const sx = ((i * 137 + parallaxX) % width + width) % width;
      const sy = ((i * 89 + parallaxY) % height + height) % height;
      ctx.beginPath();
      ctx.arc(sx, sy, 2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }

    // Смещение камеры
    const offsetX = width / 2 - this.camera.x;
    const offsetY = height / 2 - this.camera.y;

    ctx.save();
    ctx.translate(offsetX, offsetY);

    // Определяем видимую область
    const startTileX = Math.max(0, Math.floor((this.camera.x - width / 2) / TILE_SIZE) - 1);
    const startTileY = Math.max(0, Math.floor((this.camera.y - height / 2) / TILE_SIZE) - 1);
    const endTileX = Math.min(MAP_WIDTH, Math.ceil((this.camera.x + width / 2) / TILE_SIZE) + 1);
    const endTileY = Math.min(MAP_HEIGHT, Math.ceil((this.camera.y + height / 2) / TILE_SIZE) + 1);

    // Рендер тайлов земли (нижний слой)
    for (let y = startTileY; y < endTileY; y++) {
      for (let x = startTileX; x < endTileX; x++) {
        const tileType = this.map[y][x];
        const texture = this.tileTextures.get(tileType);
        
        if (texture) {
          const drawX = x * TILE_SIZE;
          const drawY = y * TILE_SIZE;

          // Анимация воды
          if (tileType === TileType.WATER) {
            ctx.save();
            const waveOffset = Math.sin(this.waterAnimOffset + x * 0.5 + y * 0.3) * 2;
            ctx.drawImage(texture, drawX + waveOffset, drawY);
            ctx.restore();
          } else {
            ctx.drawImage(texture, drawX, drawY);
          }
        }
      }
    }

    // Собираем объекты для Y-сортировки
    const renderObjects: { y: number; render: () => void }[] = [];

    // Деревья, кусты, цветы, дома (верхний слой)
    for (let y = startTileY; y < endTileY; y++) {
      for (let x = startTileX; x < endTileX; x++) {
        const tileType = this.map[y][x];
        if (tileType >= TileType.TREE_DECIDUOUS && tileType <= TileType.HOUSE) {
          const texture = this.tileTextures.get(tileType);
          if (texture) {
            const drawX = x * TILE_SIZE;
            const drawY = y * TILE_SIZE;
            // Точка привязки для Y-sorting - основание объекта
            const objY = drawY + TILE_SIZE - 10; // Основание дерева/дома
            
            renderObjects.push({
              y: objY,
              render: () => {
                // Покачивание деревьев
                if (tileType >= TileType.TREE_DECIDUOUS && tileType <= TileType.TREE_FRUIT) {
                  ctx.save();
                  const sway = Math.sin(this.gameTime * 1.5 + x + y) * 1;
                  // Точка вращения - основание дерева
                  ctx.translate(drawX + TILE_SIZE / 2, drawY + TILE_SIZE);
                  ctx.rotate((sway * Math.PI) / 180);
                  // Рисуем дерево со смещением вверх (высота текстуры 1.5 тайла)
                  ctx.drawImage(texture, -TILE_SIZE / 2, -texture.height, TILE_SIZE, texture.height);
                  ctx.restore();
                } else {
                  ctx.drawImage(texture, drawX, drawY);
                }
              }
            });
          }
        }
      }
    }

    // Игрок (точка привязки - ноги)
    renderObjects.push({
      y: this.player.y + 28, // Основание персонажа (ноги)
      render: () => this.renderPlayer(ctx),
    });

    // Другие игроки из мультиплеера
    for (const otherPlayer of this.otherPlayers) {
      renderObjects.push({
        y: otherPlayer.y + 28,
        render: () => this.renderOtherPlayer(ctx, otherPlayer),
      });
    }

    // Сортировка по Y (Y-sorting)
    renderObjects.sort((a, b) => a.y - b.y);
    renderObjects.forEach(obj => obj.render());

    // Частицы
    this.renderParticles(ctx);

    ctx.restore();

    // UI оверлей
    this.renderUI(ctx);
  }

  private renderPlayer(ctx: CanvasRenderingContext2D): void {
    if (!this.spriteSheet) return;

    const player = this.player;
    
    // Определяем индекс кадра в спрайт-листе
    let frameRow = 0;
    
    if (player.animation === 'idle') {
      const dirOffset = { down: 0, up: 4, left: 8, right: 12 }[player.direction];
      frameRow = dirOffset + (player.frameIndex % 4);
    } else if (player.animation === 'walk') {
      const dirOffset = { down: 16, up: 22, left: 28, right: 34 }[player.direction];
      frameRow = dirOffset + (player.frameIndex % 6);
    } else if (player.animation === 'run') {
      const dirOffset = { down: 40, up: 46, left: 52, right: 58 }[player.direction];
      frameRow = dirOffset + (player.frameIndex % 6);
    } else if (player.animation === 'jump') {
      frameRow = 64 + Math.min(player.frameIndex, 3);
    } else if (player.animation === 'emotion') {
      const emotionOffsets: { [key: string]: number } = {
        happy: 68, sad: 71, angry: 74, surprised: 77, love: 80, wink: 83,
      };
      const base = emotionOffsets[player.emotion || 'happy'] || 68;
      frameRow = base + (player.frameIndex % 3);
    }

    // Позиция отрисовки
    let drawX = player.x - FRAME_SIZE / 2;
    let drawY = player.y - FRAME_SIZE / 2 + player.jumpHeight;

    // 2.5D эффекты - Тень под персонажем
    ctx.save();
    const shadowAlpha = player.isJumping ? 0.15 : 0.3;
    const shadowScale = player.isJumping ? Math.max(0.3, 1 + player.jumpHeight * 0.015) : 1;
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + 28, 14 * shadowScale, 5 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Покачивание при ходьбе
    const bobY = Math.sin(player.bobOffset) * 2;
    drawY += bobY;

    // Масштабирование при прыжке
    ctx.save();
    if (player.isJumping) {
      const jumpScale = 1 + Math.abs(player.jumpHeight) * 0.005; // Усиленный эффект
      ctx.translate(player.x, drawY + FRAME_SIZE / 2);
      ctx.scale(jumpScale, jumpScale);
      ctx.drawImage(
        this.spriteSheet,
        0, frameRow * FRAME_SIZE, FRAME_SIZE, FRAME_SIZE,
        -FRAME_SIZE / 2, -FRAME_SIZE / 2, FRAME_SIZE, FRAME_SIZE
      );
    } else {
      ctx.drawImage(
        this.spriteSheet,
        0, frameRow * FRAME_SIZE, FRAME_SIZE, FRAME_SIZE,
        drawX, drawY, FRAME_SIZE, FRAME_SIZE
      );
    }
    ctx.restore();
  }

  private renderParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      ctx.globalAlpha = p.alpha;
      
      if (p.type === 'shockwave') {
        // Shockwave - расширяющееся кольцо
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        const radius = p.size * (1 - p.alpha) * 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Обычные частицы
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  private renderUI(ctx: CanvasRenderingContext2D): void {
    // Координаты
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 200, 70);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, 200, 70);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '12px monospace';
    ctx.fillText(`X: ${Math.floor(this.player.x / TILE_SIZE)}`, 20, 30);
    ctx.fillText(`Y: ${Math.floor(this.player.y / TILE_SIZE)}`, 20, 48);
    ctx.fillText(`Анимация: ${this.player.animation}`, 20, 66);

    // Мини-карта
    this.renderMinimap(ctx);
  }

  private renderMinimap(ctx: CanvasRenderingContext2D): void {
    const mapSize = 120;
    const mapX = this.canvas.width - mapSize - 10;
    const mapY = 10;
    const scale = mapSize / MAP_WIDTH;

    // Фон миникарты
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(mapX - 2, mapY - 2, mapSize + 4, mapSize + 4);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.strokeRect(mapX - 2, mapY - 2, mapSize + 4, mapSize + 4);

    // Рисуем тайлы (упрощённо)
    const step = 2; // Рисуем каждый 2-й тайл для производительности
    for (let y = 0; y < MAP_HEIGHT; y += step) {
      for (let x = 0; x < MAP_WIDTH; x += step) {
        const tile = this.map[y][x];
        let color = '#4ADE80';
        if (tile === TileType.WATER) color = '#3B82F6';
        else if (tile === TileType.SAND) color = '#FCD34D';
        else if (tile === TileType.ROAD) color = '#9CA3AF';
        else if (tile >= TileType.TREE_DECIDUOUS && tile <= TileType.TREE_FRUIT) color = '#166534';
        else if (tile === TileType.HOUSE) color = '#FBBF24';
        else if (tile === TileType.BRIDGE) color = '#92400E';
        
        ctx.fillStyle = color;
        ctx.fillRect(mapX + x * scale, mapY + y * scale, scale * step, scale * step);
      }
    }

    // Позиция игрока на миникарте
    const playerMapX = mapX + (this.player.x / TILE_SIZE) * scale;
    const playerMapY = mapY + (this.player.y / TILE_SIZE) * scale;
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(playerMapX, playerMapY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Публичные методы
  getGameState(): GameState {
    return {
      x: Math.floor(this.player.x / TILE_SIZE),
      y: Math.floor(this.player.y / TILE_SIZE),
      animation: this.player.animation,
      direction: this.player.direction,
      emotion: this.player.emotion,
      isRunning: this.player.isRunning,
      isJumping: this.player.isJumping,
    };
  }

  setStateChangeCallback(callback: (state: GameState) => void): void {
    this.onStateChange = callback;
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  destroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }
}

export interface GameState {
  x: number;
  y: number;
  animation: string;
  direction: string;
  emotion: string | null;
  isRunning: boolean;
  isJumping: boolean;
}
