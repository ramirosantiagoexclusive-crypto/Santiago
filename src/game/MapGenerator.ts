// Процедурная генерация карты с использованием шума Перлина
// Размер карты: 100x100 тайлов, размер тайла: 64x64

export const TILE_SIZE = 64;
export const MAP_WIDTH = 100;
export const MAP_HEIGHT = 100;

// Типы тайлов
export enum TileType {
  GRASS_1 = 0,
  GRASS_2 = 1,
  GRASS_3 = 2,
  WATER = 3,
  SAND = 4,
  ROAD = 5,
  TREE_DECIDUOUS = 6,
  TREE_CONIFER = 7,
  TREE_FRUIT = 8,
  FLOWER = 9,
  BUSH = 10,
  BRIDGE = 11,
  HOUSE = 12,
}

// Является ли тайл проходимым
export function isWalkable(type: TileType): boolean {
  return ![TileType.WATER, TileType.TREE_DECIDUOUS, TileType.TREE_CONIFER, 
           TileType.TREE_FRUIT, TileType.BUSH, TileType.HOUSE].includes(type);
}

// Простой шум Перлина (упрощённая реализация)
class PerlinNoise {
  private permutation: number[];

  constructor(seed: number = 42) {
    this.permutation = this.generatePermutation(seed);
  }

  private generatePermutation(seed: number): number[] {
    const perm = Array.from({ length: 256 }, (_, i) => i);
    // Перемешивание с сидом
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807 + 0) % 2147483647;
      const j = s % (i + 1);
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    return [...perm, ...perm];
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    
    x -= Math.floor(x);
    y -= Math.floor(y);
    
    const u = this.fade(x);
    const v = this.fade(y);
    
    const A = this.permutation[X] + Y;
    const B = this.permutation[X + 1] + Y;
    
    return this.lerp(
      this.lerp(this.grad(this.permutation[A], x, y), this.grad(this.permutation[B], x - 1, y), u),
      this.lerp(this.grad(this.permutation[A + 1], x, y - 1), this.grad(this.permutation[B + 1], x - 1, y - 1), u),
      v
    );
  }

  // Октавный шум для более детализированного результата
  octaveNoise(x: number, y: number, octaves: number = 4, persistence: number = 0.5): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    return total / maxValue;
  }
}

// Генерация карты
export function generateMap(seed: number = 42): TileType[][] {
  const perlin = new PerlinNoise(seed);
  const map: TileType[][] = [];

  // Генерируем базовый ландшафт с более крупными биомами
  for (let y = 0; y < MAP_HEIGHT; y++) {
    map[y] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      // Высота (определяет биом) - более низкая частота для крупных биомов
      const elevation = perlin.octaveNoise(x * 0.03, y * 0.03, 3, 0.6);

      if (elevation < -0.3) {
        map[y][x] = TileType.WATER;
      } else if (elevation < -0.15) {
        map[y][x] = TileType.SAND;
      } else {
        // Трава с вариациями
        const grassVariant = Math.abs(Math.floor(perlin.noise(x * 0.2, y * 0.2) * 3)) % 3;
        map[y][x] = TileType.GRASS_1 + grassVariant;
      }
    }
  }

  // Добавляем основные дороги (горизонтальные и вертикальные)
  const mainRoadY = [20, 50, 80];
  const mainRoadX = [20, 50, 80];

  for (const roadY of mainRoadY) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (roadY < MAP_HEIGHT && map[roadY][x] !== TileType.WATER) {
        map[roadY][x] = TileType.ROAD;
        // Ширина дороги 2 тайла
        if (roadY + 1 < MAP_HEIGHT && map[roadY + 1][x] !== TileType.WATER) {
          map[roadY + 1][x] = TileType.ROAD;
        }
      }
    }
  }

  for (const roadX of mainRoadX) {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      if (roadX < MAP_WIDTH && map[y][roadX] !== TileType.WATER) {
        map[y][roadX] = TileType.ROAD;
        // Ширина дороги 2 тайла
        if (roadX + 1 < MAP_WIDTH && map[y][roadX + 1] !== TileType.WATER) {
          map[y][roadX + 1] = TileType.ROAD;
        }
      }
    }
  }

  // Добавляем деревья кластерами (лесные массивы)
  const forestNoise = new PerlinNoise(seed + 2000);
  for (let y = 3; y < MAP_HEIGHT - 3; y++) {
    for (let x = 3; x < MAP_WIDTH - 3; x++) {
      if (map[y][x] >= TileType.GRASS_1 && map[y][x] <= TileType.GRASS_3) {
        const forestValue = forestNoise.octaveNoise(x * 0.08, y * 0.08, 2, 0.5);
        
        // Лесные массивы только в определённых зонах
        if (forestValue > 0.35) {
          const treeType = Math.floor(Math.abs(forestNoise.noise(x * 0.3, y * 0.3)) * 3);
          map[y][x] = TileType.TREE_DECIDUOUS + (treeType % 3);
        }
      }
    }
  }

  // Добавляем мосты через воду
  for (let y = 1; y < MAP_HEIGHT - 1; y++) {
    for (let x = 1; x < MAP_WIDTH - 1; x++) {
      if (map[y][x] === TileType.WATER) {
        // Проверяем, есть ли дорога рядом
        if ((map[y - 1]?.[x] === TileType.ROAD && map[y + 1]?.[x] === TileType.ROAD) ||
            (map[y]?.[x - 1] === TileType.ROAD && map[y]?.[x + 1] === TileType.ROAD)) {
          map[y][x] = TileType.BRIDGE;
        }
      }
    }
  }

  // Добавляем дома вдоль дорог
  const housePositions = [
    { x: 22, y: 22 }, { x: 48, y: 22 }, { x: 78, y: 22 },
    { x: 22, y: 52 }, { x: 48, y: 52 }, { x: 78, y: 52 },
    { x: 22, y: 78 }, { x: 48, y: 78 }, { x: 78, y: 78 },
  ];

  for (const pos of housePositions) {
    if (pos.x < MAP_WIDTH && pos.y < MAP_HEIGHT) {
      if (map[pos.y][pos.x] !== TileType.WATER && map[pos.y][pos.x] !== TileType.ROAD) {
        map[pos.y][pos.x] = TileType.HOUSE;
      }
    }
  }

  // Очищаем стартовую зону (большую)
  for (let y = 45; y < 55; y++) {
    for (let x = 45; x < 55; x++) {
      if (y < MAP_HEIGHT && x < MAP_WIDTH) {
        map[y][x] = TileType.GRASS_1;
      }
    }
  }

  return map;
}

// Генерация тайловой текстуры
export function generateTileTextures(): Map<TileType, HTMLCanvasElement> {
  const textures = new Map<TileType, HTMLCanvasElement>();

  // Трава (3 варианта)
  for (let i = 0; i < 3; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = TILE_SIZE;
    canvas.height = TILE_SIZE;
    const ctx = canvas.getContext('2d')!;
    
    // Базовый цвет травы
    const greens = ['#4ADE80', '#22C55E', '#16A34A'];
    ctx.fillStyle = greens[i];
    ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    
    // Текстура травы
    const rng = mulberry32(i * 12345);
    for (let j = 0; j < 20; j++) {
      const gx = rng() * TILE_SIZE;
      const gy = rng() * TILE_SIZE;
      ctx.strokeStyle = `rgba(0, 100, 0, ${0.2 + rng() * 0.3})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + (rng() - 0.5) * 4, gy - 3 - rng() * 4);
      ctx.stroke();
    }
    
    // Точки/цветочки
    for (let j = 0; j < 5; j++) {
      const dx = rng() * TILE_SIZE;
      const dy = rng() * TILE_SIZE;
      ctx.fillStyle = `rgba(255, 255, 100, ${0.3 + rng() * 0.3})`;
      ctx.beginPath();
      ctx.arc(dx, dy, 1 + rng(), 0, Math.PI * 2);
      ctx.fill();
    }
    
    textures.set(TileType.GRASS_1 + i, canvas);
  }

  // Вода
  const waterCanvas = document.createElement('canvas');
  waterCanvas.width = TILE_SIZE;
  waterCanvas.height = TILE_SIZE;
  const waterCtx = waterCanvas.getContext('2d')!;
  
  // Градиент воды
  const waterGrad = waterCtx.createLinearGradient(0, 0, TILE_SIZE, TILE_SIZE);
  waterGrad.addColorStop(0, '#3B82F6');
  waterGrad.addColorStop(0.5, '#2563EB');
  waterGrad.addColorStop(1, '#1D4ED8');
  waterCtx.fillStyle = waterGrad;
  waterCtx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  
  // Волны
  waterCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  waterCtx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    waterCtx.beginPath();
    const yOff = 10 + i * 15;
    for (let x = 0; x < TILE_SIZE; x += 2) {
      const y = yOff + Math.sin(x * 0.1 + i) * 3;
      if (x === 0) waterCtx.moveTo(x, y);
      else waterCtx.lineTo(x, y);
    }
    waterCtx.stroke();
  }
  textures.set(TileType.WATER, waterCanvas);

  // Песок
  const sandCanvas = document.createElement('canvas');
  sandCanvas.width = TILE_SIZE;
  sandCanvas.height = TILE_SIZE;
  const sandCtx = sandCanvas.getContext('2d')!;
  sandCtx.fillStyle = '#FCD34D';
  sandCtx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  
  const sandRng = mulberry32(999);
  for (let i = 0; i < 50; i++) {
    sandCtx.fillStyle = `rgba(180, 140, 50, ${0.1 + sandRng() * 0.2})`;
    sandCtx.beginPath();
    sandCtx.arc(sandRng() * TILE_SIZE, sandRng() * TILE_SIZE, sandRng() * 2, 0, Math.PI * 2);
    sandCtx.fill();
  }
  textures.set(TileType.SAND, sandCanvas);

  // Дорога
  const roadCanvas = document.createElement('canvas');
  roadCanvas.width = TILE_SIZE;
  roadCanvas.height = TILE_SIZE;
  const roadCtx = roadCanvas.getContext('2d')!;
  roadCtx.fillStyle = '#9CA3AF';
  roadCtx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  
  // Камушки
  const roadRng = mulberry32(777);
  for (let i = 0; i < 15; i++) {
    roadCtx.fillStyle = `rgba(100, 100, 100, ${0.3 + roadRng() * 0.3})`;
    roadCtx.beginPath();
    roadCtx.arc(roadRng() * TILE_SIZE, roadRng() * TILE_SIZE, 2 + roadRng() * 3, 0, Math.PI * 2);
    roadCtx.fill();
  }
  
  // Границы дороги
  roadCtx.strokeStyle = 'rgba(80, 80, 80, 0.3)';
  roadCtx.lineWidth = 2;
  roadCtx.strokeRect(2, 2, TILE_SIZE - 4, TILE_SIZE - 4);
  textures.set(TileType.ROAD, roadCanvas);

  // Мост
  const bridgeCanvas = document.createElement('canvas');
  bridgeCanvas.width = TILE_SIZE;
  bridgeCanvas.height = TILE_SIZE;
  const bridgeCtx = bridgeCanvas.getContext('2d')!;
  bridgeCtx.fillStyle = '#92400E';
  bridgeCtx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  
  // Доски
  for (let i = 0; i < 8; i++) {
    bridgeCtx.fillStyle = i % 2 === 0 ? '#78350F' : '#A16207';
    bridgeCtx.fillRect(0, i * 8, TILE_SIZE, 7);
    bridgeCtx.strokeStyle = '#451A03';
    bridgeCtx.lineWidth = 0.5;
    bridgeCtx.strokeRect(0, i * 8, TILE_SIZE, 7);
  }
  
  // Перила
  bridgeCtx.fillStyle = '#451A03';
  bridgeCtx.fillRect(0, 0, 4, TILE_SIZE);
  bridgeCtx.fillRect(TILE_SIZE - 4, 0, 4, TILE_SIZE);
  textures.set(TileType.BRIDGE, bridgeCanvas);

  // Дерево лиственное
  textures.set(TileType.TREE_DECIDUOUS, generateTreeTexture('deciduous'));
  
  // Дерево хвойное
  textures.set(TileType.TREE_CONIFER, generateTreeTexture('conifer'));
  
  // Дерево плодоносящее
  textures.set(TileType.TREE_FRUIT, generateTreeTexture('fruit'));

  // Цветы
  const flowerCanvas = document.createElement('canvas');
  flowerCanvas.width = TILE_SIZE;
  flowerCanvas.height = TILE_SIZE;
  const flowerCtx = flowerCanvas.getContext('2d')!;
  flowerCtx.fillStyle = '#4ADE80';
  flowerCtx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  
  // Цветочки
  const flowerColors = ['#F472B6', '#FB923C', '#FACC15', '#A78BFA', '#F87171'];
  const flowerRng = mulberry32(555);
  for (let i = 0; i < 8; i++) {
    const fx = 10 + flowerRng() * (TILE_SIZE - 20);
    const fy = 10 + flowerRng() * (TILE_SIZE - 20);
    const color = flowerColors[Math.floor(flowerRng() * flowerColors.length)];
    
    // Стебель
    flowerCtx.strokeStyle = '#166534';
    flowerCtx.lineWidth = 1.5;
    flowerCtx.beginPath();
    flowerCtx.moveTo(fx, fy + 6);
    flowerCtx.lineTo(fx, fy + 14);
    flowerCtx.stroke();
    
    // Лепестки
    flowerCtx.fillStyle = color;
    for (let p = 0; p < 5; p++) {
      const angle = (p / 5) * Math.PI * 2;
      flowerCtx.beginPath();
      flowerCtx.arc(fx + Math.cos(angle) * 3, fy + Math.sin(angle) * 3, 2.5, 0, Math.PI * 2);
      flowerCtx.fill();
    }
    // Центр
    flowerCtx.fillStyle = '#FCD34D';
    flowerCtx.beginPath();
    flowerCtx.arc(fx, fy, 2, 0, Math.PI * 2);
    flowerCtx.fill();
  }
  textures.set(TileType.FLOWER, flowerCanvas);

  // Куст
  const bushCanvas = document.createElement('canvas');
  bushCanvas.width = TILE_SIZE;
  bushCanvas.height = TILE_SIZE;
  const bushCtx = bushCanvas.getContext('2d')!;
  bushCtx.fillStyle = '#4ADE80';
  bushCtx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  
  // Куст
  bushCtx.fillStyle = '#15803D';
  bushCtx.beginPath();
  bushCtx.arc(32, 38, 16, 0, Math.PI * 2);
  bushCtx.fill();
  bushCtx.fillStyle = '#166534';
  bushCtx.beginPath();
  bushCtx.arc(26, 34, 10, 0, Math.PI * 2);
  bushCtx.fill();
  bushCtx.fillStyle = '#22C55E';
  bushCtx.beginPath();
  bushCtx.arc(38, 32, 11, 0, Math.PI * 2);
  bushCtx.fill();
  // Блик
  bushCtx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  bushCtx.beginPath();
  bushCtx.arc(34, 28, 5, 0, Math.PI * 2);
  bushCtx.fill();
  textures.set(TileType.BUSH, bushCanvas);

  // Дом
  const houseCanvas = document.createElement('canvas');
  houseCanvas.width = TILE_SIZE;
  houseCanvas.height = TILE_SIZE;
  const houseCtx = houseCanvas.getContext('2d')!;
  houseCtx.fillStyle = '#4ADE80';
  houseCtx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  
  // Стены дома
  houseCtx.fillStyle = '#FBBF24';
  houseCtx.fillRect(12, 24, 40, 32);
  houseCtx.strokeStyle = '#92400E';
  houseCtx.lineWidth = 2;
  houseCtx.strokeRect(12, 24, 40, 32);
  
  // Крыша
  houseCtx.fillStyle = '#DC2626';
  houseCtx.beginPath();
  houseCtx.moveTo(8, 24);
  houseCtx.lineTo(32, 8);
  houseCtx.lineTo(56, 24);
  houseCtx.closePath();
  houseCtx.fill();
  houseCtx.strokeStyle = '#991B1B';
  houseCtx.stroke();
  
  // Дверь
  houseCtx.fillStyle = '#78350F';
  houseCtx.fillRect(26, 38, 12, 18);
  houseCtx.strokeStyle = '#451A03';
  houseCtx.strokeRect(26, 38, 12, 18);
  
  // Ручка двери
  houseCtx.fillStyle = '#FCD34D';
  houseCtx.beginPath();
  houseCtx.arc(35, 48, 1.5, 0, Math.PI * 2);
  houseCtx.fill();
  
  // Окна
  houseCtx.fillStyle = '#93C5FD';
  houseCtx.fillRect(16, 30, 8, 8);
  houseCtx.fillRect(40, 30, 8, 8);
  houseCtx.strokeStyle = '#78350F';
  houseCtx.lineWidth = 1;
  houseCtx.strokeRect(16, 30, 8, 8);
  houseCtx.strokeRect(40, 30, 8, 8);
  // Крест на окнах
  houseCtx.beginPath();
  houseCtx.moveTo(20, 30);
  houseCtx.lineTo(20, 38);
  houseCtx.moveTo(16, 34);
  houseCtx.lineTo(24, 34);
  houseCtx.moveTo(44, 30);
  houseCtx.lineTo(44, 38);
  houseCtx.moveTo(40, 34);
  houseCtx.lineTo(48, 34);
  houseCtx.stroke();
  
  textures.set(TileType.HOUSE, houseCanvas);

  return textures;
}

function generateTreeTexture(type: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE * 1.5; // Увеличенная высота для деревьев
  const ctx = canvas.getContext('2d')!;
  
  // Прозрачный фон
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Тень у основания
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.ellipse(32, canvas.height - 8, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (type === 'deciduous') {
    // Ствол
    ctx.fillStyle = '#78350F';
    ctx.fillRect(28, canvas.height - 30, 8, 22);
    ctx.strokeStyle = '#451A03';
    ctx.lineWidth = 1;
    ctx.strokeRect(28, canvas.height - 30, 8, 22);
    
    // Крона (выше)
    ctx.fillStyle = '#15803D';
    ctx.beginPath();
    ctx.arc(32, canvas.height - 50, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22C55E';
    ctx.beginPath();
    ctx.arc(26, canvas.height - 56, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#16A34A';
    ctx.beginPath();
    ctx.arc(38, canvas.height - 52, 12, 0, Math.PI * 2);
    ctx.fill();
    // Блик
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.arc(24, canvas.height - 62, 7, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'conifer') {
    // Ствол
    ctx.fillStyle = '#78350F';
    ctx.fillRect(29, canvas.height - 28, 6, 20);
    
    // Ёлка (треугольники, выше)
    ctx.fillStyle = '#166534';
    ctx.beginPath();
    ctx.moveTo(32, canvas.height - 90);
    ctx.lineTo(18, canvas.height - 60);
    ctx.lineTo(46, canvas.height - 60);
    ctx.closePath();
    ctx.fill();
    
    ctx.fillStyle = '#15803D';
    ctx.beginPath();
    ctx.moveTo(32, canvas.height - 75);
    ctx.lineTo(14, canvas.height - 45);
    ctx.lineTo(50, canvas.height - 45);
    ctx.closePath();
    ctx.fill();
    
    ctx.fillStyle = '#166534';
    ctx.beginPath();
    ctx.moveTo(32, canvas.height - 60);
    ctx.lineTo(12, canvas.height - 30);
    ctx.lineTo(52, canvas.height - 30);
    ctx.closePath();
    ctx.fill();
    
    // Блик
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(32, canvas.height - 88);
    ctx.lineTo(26, canvas.height - 70);
    ctx.lineTo(32, canvas.height - 72);
    ctx.closePath();
    ctx.fill();
  } else if (type === 'fruit') {
    // Ствол
    ctx.fillStyle = '#78350F';
    ctx.fillRect(28, canvas.height - 30, 8, 22);
    ctx.strokeStyle = '#451A03';
    ctx.lineWidth = 1;
    ctx.strokeRect(28, canvas.height - 30, 8, 22);
    
    // Крона (выше)
    ctx.fillStyle = '#22C55E';
    ctx.beginPath();
    ctx.arc(32, canvas.height - 50, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4ADE80';
    ctx.beginPath();
    ctx.arc(26, canvas.height - 56, 12, 0, Math.PI * 2);
    ctx.fill();
    
    // Фрукты (яблоки)
    const fruitPositions = [
      { x: 22, y: canvas.height - 48 }, { x: 38, y: canvas.height - 46 },
      { x: 30, y: canvas.height - 40 }, { x: 18, y: canvas.height - 42 },
      { x: 42, y: canvas.height - 44 },
    ];
    fruitPositions.forEach(fp => {
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(fp.x, fp.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(fp.x - 1, fp.y - 1, 1, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  return canvas;
}

// Генератор псевдослучайных чисел (детерминированный)
function mulberry32(seed: number): () => number {
  return function() {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
