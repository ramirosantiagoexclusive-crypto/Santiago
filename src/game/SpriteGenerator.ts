// Генератор спрайтов персонажа в стиле anime/chibi
// Размер кадра: 64x64 пикселя

export const FRAME_SIZE = 64;

// Polyfill для roundRect если не поддерживается браузером
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  (CanvasRenderingContext2D.prototype as any).roundRect = function(x: number, y: number, w: number, h: number, radii: number | number[]) {
    const r = typeof radii === 'number' ? radii : (Array.isArray(radii) ? radii[0] : 0);
    this.beginPath();
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r);
    this.lineTo(x + w, y + h - r);
    this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r);
    this.lineTo(x, y + r);
    this.quadraticCurveTo(x, y, x + r, y);
    this.closePath();
    return this;
  };
}

// Цвета персонажа
const COLORS = {
  hair: '#3B82F6',
  hairDark: '#1D4ED8',
  hairLight: '#60A5FA',
  skin: '#FBBF7D',
  skinDark: '#E8A055',
  skinBlush: '#F87171',
  jacket: '#DC2626',
  jacketDark: '#991B1B',
  jacketLight: '#EF4444',
  pants: '#1F2937',
  pantsDark: '#111827',
  boots: '#78350F',
  bootsDark: '#451A03',
  bootsLight: '#92400E',
  eyes: '#1E3A5F',
  eyeWhite: '#FFFFFF',
  outline: '#1F2937',
  mouth: '#DC2626',
  tear: '#60A5FA',
  heart: '#EF4444',
};

// Типы направлений
export type Direction = 'down' | 'up' | 'left' | 'right';

// Типы анимаций
export type AnimationType = 'idle' | 'walk' | 'run' | 'jump' | 'emotion';

// Эмоции
export type Emotion = 'happy' | 'sad' | 'angry' | 'surprised' | 'love' | 'wink';

interface SpriteSheet {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

// Класс для рисования персонажа в одном кадре
class CharacterDrawer {
  private ctx: CanvasRenderingContext2D;
  private offsetX: number;
  private offsetY: number;

  constructor(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number) {
    this.ctx = ctx;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
  }

  // Рисуем тело персонажа с учётом направления и анимации
  drawFrame(direction: Direction, animFrame: number, animType: AnimationType, emotion?: Emotion) {
    const ctx = this.ctx;
    const ox = this.offsetX;
    const oy = this.offsetY;

    ctx.save();
    ctx.translate(ox, oy);

    // Смещение для анимации ходьбы/бега
    let bobY = 0;
    let leanX = 0;
    let armSwing = 0;
    let legSwing = 0;

    if (animType === 'walk') {
      bobY = Math.sin(animFrame * Math.PI / 3) * 2;
      armSwing = Math.sin(animFrame * Math.PI / 3) * 8;
      legSwing = Math.sin(animFrame * Math.PI / 3) * 6;
    } else if (animType === 'run') {
      bobY = Math.sin(animFrame * Math.PI / 3) * 3;
      leanX = direction === 'right' ? 3 : direction === 'left' ? -3 : 0;
      armSwing = Math.sin(animFrame * Math.PI / 3) * 15;
      legSwing = Math.sin(animFrame * Math.PI / 3) * 12;
    } else if (animType === 'idle') {
      bobY = Math.sin(animFrame * Math.PI / 2) * 1;
    } else if (animType === 'jump') {
      // Разные позы для прыжка
      if (animFrame === 0) {
        // Подготовка (присед)
        bobY = 4;
        legSwing = -3;
      } else if (animFrame === 1) {
        // Взлёт (руки вверх, ноги вместе)
        bobY = -2;
        armSwing = -20;
        legSwing = -2;
      } else if (animFrame === 2) {
        // Пик (раскинутые руки)
        bobY = -4;
        armSwing = -15;
        legSwing = 3;
      } else {
        // Приземление (группировка)
        bobY = 2;
        legSwing = 2;
      }
    }

    ctx.translate(leanX, bobY);

    // Рисуем тень
    this.drawShadow();

    // Рисуем ноги
    this.drawLegs(direction, legSwing);

    // Рисуем ботинки
    this.drawBoots(direction, legSwing);

    // Рисуем тело (куртка)
    this.drawBody(direction);

    // Рисуем руки
    this.drawArms(direction, armSwing, emotion);

    // Рисуем голову
    this.drawHead(direction, emotion, animType, animFrame);

    ctx.restore();
  }

  private drawShadow() {
    // Тень рисуется динамически в GameEngine для 2.5D эффекта
    // Здесь оставляем пустым
  }

  private drawLegs(direction: Direction, swing: number) {
    const ctx = this.ctx;
    
    // Левая нога
    ctx.fillStyle = COLORS.pants;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1;
    
    const leftLegX = 26;
    const rightLegX = 34;
    const legY = 44;
    const legH = 10;
    const legW = 6;

    // Левая нога
    ctx.beginPath();
    ctx.roundRect(leftLegX - swing * 0.3, legY, legW, legH, 2);
    ctx.fill();
    ctx.stroke();

    // Правая нога
    ctx.beginPath();
    ctx.roundRect(rightLegX + swing * 0.3, legY, legW, legH, 2);
    ctx.fill();
    ctx.stroke();

    // Тени на штанах
    ctx.fillStyle = COLORS.pantsDark;
    ctx.beginPath();
    ctx.roundRect(leftLegX - swing * 0.3 + 1, legY + 2, 2, legH - 4, 1);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(rightLegX + swing * 0.3 + 1, legY + 2, 2, legH - 4, 1);
    ctx.fill();
  }

  private drawBoots(direction: Direction, swing: number) {
    const ctx = this.ctx;
    const bootY = 53;
    const bootW = 8;
    const bootH = 5;

    // Левый ботинок
    ctx.fillStyle = COLORS.boots;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(24 - swing * 0.3, bootY, bootW, bootH, 2);
    ctx.fill();
    ctx.stroke();

    // Блик на ботинке
    ctx.fillStyle = COLORS.bootsLight;
    ctx.beginPath();
    ctx.roundRect(25 - swing * 0.3, bootY + 1, 3, 2, 1);
    ctx.fill();

    // Правый ботинок
    ctx.fillStyle = COLORS.boots;
    ctx.beginPath();
    ctx.roundRect(33 + swing * 0.3, bootY, bootW, bootH, 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = COLORS.bootsLight;
    ctx.beginPath();
    ctx.roundRect(34 + swing * 0.3, bootY + 1, 3, 2, 1);
    ctx.fill();
  }

  private drawBody(direction: Direction) {
    const ctx = this.ctx;
    
    // Тело (куртка)
    const bodyX = 22;
    const bodyY = 28;
    const bodyW = 20;
    const bodyH = 18;

    // Основная часть куртки
    ctx.fillStyle = COLORS.jacket;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(bodyX, bodyY, bodyW, bodyH, 3);
    ctx.fill();
    ctx.stroke();

    // Тёмная сторона куртки (тень)
    ctx.fillStyle = COLORS.jacketDark;
    ctx.beginPath();
    ctx.roundRect(bodyX + bodyW - 5, bodyY + 2, 4, bodyH - 4, 2);
    ctx.fill();

    // Светлая сторона (блик)
    ctx.fillStyle = COLORS.jacketLight;
    ctx.beginPath();
    ctx.roundRect(bodyX + 2, bodyY + 2, 3, bodyH - 6, 1);
    ctx.fill();

    // Молния
    ctx.strokeStyle = '#FCD34D';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(32, bodyY + 2);
    ctx.lineTo(32, bodyY + bodyH - 2);
    ctx.stroke();

    // Застёжка молнии
    ctx.fillStyle = '#FCD34D';
    ctx.beginPath();
    ctx.arc(32, bodyY + 4, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Карманы
    ctx.strokeStyle = COLORS.jacketDark;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(bodyX + 3, bodyY + 10, 6, 5, 1);
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(bodyX + bodyW - 9, bodyY + 10, 6, 5, 1);
    ctx.stroke();
  }

  private drawArms(direction: Direction, swing: number, emotion?: Emotion) {
    const ctx = this.ctx;
    
    let leftArmAngle = swing;
    let rightArmAngle = -swing;
    let leftArmY = 30;
    let rightArmY = 30;

    // Эмоции влияют на руки
    if (emotion === 'happy' || emotion === 'surprised') {
      leftArmY = 22;
      rightArmY = 22;
    } else if (emotion === 'angry') {
      leftArmAngle = -5;
      rightArmAngle = 5;
    } else if (emotion === 'sad') {
      leftArmY = 36;
      rightArmY = 36;
    }

    // Левая рука
    ctx.fillStyle = COLORS.jacket;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1.5;
    
    ctx.save();
    ctx.translate(22, leftArmY);
    ctx.rotate((leftArmAngle * Math.PI) / 180);
    ctx.beginPath();
    ctx.roundRect(-3, 0, 6, 14, 3);
    ctx.fill();
    ctx.stroke();
    
    // Кисть руки
    ctx.fillStyle = COLORS.skin;
    ctx.beginPath();
    ctx.arc(0, 14, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Правая рука
    ctx.fillStyle = COLORS.jacket;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1.5;
    
    ctx.save();
    ctx.translate(42, rightArmY);
    ctx.rotate((rightArmAngle * Math.PI) / 180);
    ctx.beginPath();
    ctx.roundRect(-3, 0, 6, 14, 3);
    ctx.fill();
    ctx.stroke();
    
    // Кисть руки
    ctx.fillStyle = COLORS.skin;
    ctx.beginPath();
    ctx.arc(0, 14, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  private drawHead(direction: Direction, emotion?: Emotion, animType?: AnimationType, animFrame?: number) {
    const ctx = this.ctx;
    const headX = 20;
    const headY = 6;
    const headW = 24;
    const headH = 24;

    // Шея
    ctx.fillStyle = COLORS.skin;
    ctx.fillRect(29, 26, 6, 4);

    // Голова (форма)
    ctx.fillStyle = COLORS.skin;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(32, 18, 13, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Румянец (для эмоции love)
    if (emotion === 'love') {
      ctx.fillStyle = 'rgba(248, 113, 113, 0.4)';
      ctx.beginPath();
      ctx.ellipse(24, 21, 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(40, 21, 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Волосы
    this.drawHair(direction);

    // Глаза и лицо
    this.drawFace(direction, emotion, animFrame);

    // Эффекты эмоций
    if (emotion === 'love') {
      this.drawHearts();
    } else if (emotion === 'sad') {
      this.drawTears();
    } else if (emotion === 'surprised') {
      this.drawSurpriseMarks();
    }
  }

  private drawHair(direction: Direction) {
    const ctx = this.ctx;

    // Основная масса волос (сзади)
    ctx.fillStyle = COLORS.hairDark;
    ctx.beginPath();
    ctx.ellipse(32, 14, 14, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    // Верхняя часть волос
    ctx.fillStyle = COLORS.hair;
    ctx.beginPath();
    ctx.ellipse(32, 12, 13, 11, 0, -Math.PI, 0);
    ctx.fill();

    // Блик на волосах
    ctx.fillStyle = COLORS.hairLight;
    ctx.beginPath();
    ctx.ellipse(28, 8, 5, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Челка (зависит от направления)
    ctx.fillStyle = COLORS.hair;
    ctx.strokeStyle = COLORS.hairDark;
    ctx.lineWidth = 0.5;

    if (direction === 'down' || direction === 'left' || direction === 'right') {
      // Челка спереди
      ctx.beginPath();
      ctx.moveTo(22, 14);
      ctx.quadraticCurveTo(24, 18, 26, 16);
      ctx.quadraticCurveTo(28, 14, 30, 17);
      ctx.quadraticCurveTo(32, 14, 34, 17);
      ctx.quadraticCurveTo(36, 14, 38, 16);
      ctx.quadraticCurveTo(40, 18, 42, 14);
      ctx.quadraticCurveTo(40, 6, 32, 5);
      ctx.quadraticCurveTo(24, 6, 22, 14);
      ctx.fill();
      ctx.stroke();
    }

    if (direction === 'up') {
      // Вид сзади - волосы закрывают лицо
      ctx.fillStyle = COLORS.hair;
      ctx.beginPath();
      ctx.ellipse(32, 15, 12, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Пряди волос сзади
      ctx.fillStyle = COLORS.hairDark;
      ctx.beginPath();
      ctx.moveTo(24, 20);
      ctx.quadraticCurveTo(22, 26, 25, 28);
      ctx.quadraticCurveTo(26, 24, 28, 20);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(36, 20);
      ctx.quadraticCurveTo(38, 26, 39, 28);
      ctx.quadraticCurveTo(40, 24, 38, 20);
      ctx.fill();
    }

    // Боковые пряди
    if (direction !== 'up') {
      ctx.fillStyle = COLORS.hair;
      // Левая прядь
      ctx.beginPath();
      ctx.moveTo(19, 14);
      ctx.quadraticCurveTo(17, 20, 19, 25);
      ctx.quadraticCurveTo(20, 22, 21, 18);
      ctx.fill();
      // Правая прядь
      ctx.beginPath();
      ctx.moveTo(45, 14);
      ctx.quadraticCurveTo(47, 20, 45, 25);
      ctx.quadraticCurveTo(44, 22, 43, 18);
      ctx.fill();
    }

    // Контур волос
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(32, 12, 13, 11, 0, -Math.PI, 0);
    ctx.stroke();
  }

  private drawFace(direction: Direction, emotion?: Emotion, animFrame?: number) {
    const ctx = this.ctx;

    if (direction === 'up') return; // Сзади не видно лицо

    const eyeY = 18;
    const leftEyeX = 27;
    const rightEyeX = 37;

    // Определяем состояние глаз
    let leftEyeClosed = false;
    let rightEyeClosed = false;
    let eyeSize = 3;
    let mouthType = 'neutral';

    if (emotion === 'wink') {
      rightEyeClosed = true;
      mouthType = 'smile';
    } else if (emotion === 'happy') {
      mouthType = 'bigSmile';
      eyeSize = 2.5;
    } else if (emotion === 'sad') {
      mouthType = 'frown';
      eyeSize = 2.5;
    } else if (emotion === 'angry') {
      mouthType = 'angry';
      eyeSize = 3;
    } else if (emotion === 'surprised') {
      mouthType = 'open';
      eyeSize = 4;
    } else if (emotion === 'love') {
      mouthType = 'smile';
      eyeSize = 3.5;
    }

    // Рисуем глаза
    if (!leftEyeClosed) {
      // Белок глаза
      ctx.fillStyle = COLORS.eyeWhite;
      ctx.beginPath();
      ctx.ellipse(leftEyeX, eyeY, eyeSize, eyeSize + 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.outline;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Зрачок
      ctx.fillStyle = COLORS.eyes;
      ctx.beginPath();
      ctx.ellipse(leftEyeX, eyeY + 0.5, eyeSize * 0.6, eyeSize * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Блик в глазу
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(leftEyeX - 1, eyeY - 1, 1, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Закрытый глаз (линия)
      ctx.strokeStyle = COLORS.outline;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(leftEyeX - 3, eyeY);
      ctx.quadraticCurveTo(leftEyeX, eyeY + 2, leftEyeX + 3, eyeY);
      ctx.stroke();
    }

    if (!rightEyeClosed) {
      ctx.fillStyle = COLORS.eyeWhite;
      ctx.beginPath();
      ctx.ellipse(rightEyeX, eyeY, eyeSize, eyeSize + 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.outline;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = COLORS.eyes;
      ctx.beginPath();
      ctx.ellipse(rightEyeX, eyeY + 0.5, eyeSize * 0.6, eyeSize * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(rightEyeX - 1, eyeY - 1, 1, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = COLORS.outline;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(rightEyeX - 3, eyeY);
      ctx.quadraticCurveTo(rightEyeX, eyeY - 2, rightEyeX + 3, eyeY);
      ctx.stroke();
    }

    // Брови
    ctx.strokeStyle = COLORS.hairDark;
    ctx.lineWidth = 1.5;
    
    if (emotion === 'angry') {
      // Злые брови
      ctx.beginPath();
      ctx.moveTo(leftEyeX - 3, eyeY - 5);
      ctx.lineTo(leftEyeX + 2, eyeY - 7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rightEyeX + 3, eyeY - 5);
      ctx.lineTo(rightEyeX - 2, eyeY - 7);
      ctx.stroke();
    } else if (emotion === 'sad') {
      // Грустные брови
      ctx.beginPath();
      ctx.moveTo(leftEyeX - 3, eyeY - 7);
      ctx.lineTo(leftEyeX + 2, eyeY - 5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rightEyeX + 3, eyeY - 7);
      ctx.lineTo(rightEyeX - 2, eyeY - 5);
      ctx.stroke();
    } else if (emotion === 'surprised') {
      // Удивлённые брови (подняты)
      ctx.beginPath();
      ctx.moveTo(leftEyeX - 3, eyeY - 7);
      ctx.lineTo(leftEyeX + 3, eyeY - 7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rightEyeX - 3, eyeY - 7);
      ctx.lineTo(rightEyeX + 3, eyeY - 7);
      ctx.stroke();
    } else {
      // Обычные брови
      ctx.beginPath();
      ctx.moveTo(leftEyeX - 3, eyeY - 5);
      ctx.lineTo(leftEyeX + 3, eyeY - 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rightEyeX - 3, eyeY - 6);
      ctx.lineTo(rightEyeX + 3, eyeY - 5);
      ctx.stroke();
    }

    // Рот
    const mouthY = 24;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1.5;

    switch (mouthType) {
      case 'smile':
        ctx.beginPath();
        ctx.moveTo(29, mouthY);
        ctx.quadraticCurveTo(32, mouthY + 3, 35, mouthY);
        ctx.stroke();
        break;
      case 'bigSmile':
        ctx.fillStyle = COLORS.mouth;
        ctx.beginPath();
        ctx.moveTo(28, mouthY - 1);
        ctx.quadraticCurveTo(32, mouthY + 5, 36, mouthY - 1);
        ctx.quadraticCurveTo(32, mouthY + 2, 28, mouthY - 1);
        ctx.fill();
        ctx.stroke();
        break;
      case 'frown':
        ctx.beginPath();
        ctx.moveTo(29, mouthY + 2);
        ctx.quadraticCurveTo(32, mouthY - 1, 35, mouthY + 2);
        ctx.stroke();
        break;
      case 'angry':
        ctx.beginPath();
        ctx.moveTo(29, mouthY + 1);
        ctx.lineTo(35, mouthY + 1);
        ctx.stroke();
        break;
      case 'open':
        ctx.fillStyle = COLORS.mouth;
        ctx.beginPath();
        ctx.ellipse(32, mouthY + 1, 3, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = COLORS.outline;
        ctx.stroke();
        break;
      default:
        ctx.beginPath();
        ctx.moveTo(30, mouthY);
        ctx.quadraticCurveTo(32, mouthY + 1.5, 34, mouthY);
        ctx.stroke();
    }

    // Нос (маленький)
    if (direction === 'down') {
      ctx.fillStyle = COLORS.skinDark;
      ctx.beginPath();
      ctx.arc(32, 21, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawHearts() {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.heart;
    
    // Рисуем сердечки вокруг головы
    const hearts = [
      { x: 14, y: 6, s: 0.8 },
      { x: 50, y: 8, s: 0.6 },
      { x: 10, y: 16, s: 0.5 },
      { x: 52, y: 18, s: 0.7 },
    ];

    hearts.forEach(h => {
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.scale(h.s, h.s);
      ctx.beginPath();
      ctx.moveTo(0, -3);
      ctx.bezierCurveTo(-5, -8, -10, -3, 0, 5);
      ctx.bezierCurveTo(10, -3, 5, -8, 0, -3);
      ctx.fill();
      ctx.restore();
    });
  }

  private drawTears() {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.tear;
    
    // Слезинки
    ctx.beginPath();
    ctx.moveTo(25, 20);
    ctx.quadraticCurveTo(24, 24, 25, 27);
    ctx.quadraticCurveTo(26, 24, 25, 20);
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(39, 21);
    ctx.quadraticCurveTo(38, 25, 39, 28);
    ctx.quadraticCurveTo(40, 25, 39, 21);
    ctx.fill();
  }

  private drawSurpriseMarks() {
    const ctx = this.ctx;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1.5;
    
    // Восклицательные знаки / линии удивления
    const marks = [
      { x: 12, y: 4 },
      { x: 52, y: 4 },
      { x: 8, y: 12 },
      { x: 56, y: 12 },
    ];

    marks.forEach(m => {
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x + (m.x < 32 ? -3 : 3), m.y - 4);
      ctx.stroke();
    });
  }
}

// Генерация полного спрайт-листа
export function generateSpriteSheet(): SpriteSheet {
  // Рассчитываем размер спрайт-листа
  // Idle: 4 кадра * 4 направления = 16
  // Walk: 6 кадров * 4 направления = 24
  // Run: 6 кадров * 4 направления = 24
  // Jump: 4 кадра * 1 (только вниз) = 4
  // Emotions: 6 эмоций * 3 кадра * 1 (только вниз) = 18
  // Итого: 86 кадров
  
  const directions: Direction[] = ['down', 'up', 'left', 'right'];
  const emotions: Emotion[] = ['happy', 'sad', 'angry', 'surprised', 'love', 'wink'];
  
  // Создаём сетку спрайтов
  // Строки: idle(4), walk(6), run(6), jump(4), emotions(6*3=18)
  // Столбцы: 4 направления (для основных) или 1 (для эмоций/прыжка)
  
  const cols = 6; // Максимум кадров в строке
  const totalRows = 4 + 6 + 6 + 4 + 6 * 3; // = 38 строк (но мы организуем по-другому)
  
  // Более компактная организация:
  // Ряд 0-3: Idle down (4 кадра), Ряд 4-7: Idle up, Ряд 8-11: Idle left, Ряд 12-15: Idle right
  // Ряд 16-21: Walk down, Ряд 22-27: Walk up, Ряд 28-33: Walk left, Ряд 34-39: Walk right
  // Ряд 40-45: Run down, Ряд 46-51: Run up, Ряд 52-57: Run left, Ряд 58-63: Run right
  // Ряд 64-67: Jump (4 кадра)
  // Ряд 68-70: Happy, Ряд 71-73: Sad, Ряд 74-76: Angry, Ряд 77-79: Surprised, Ряд 80-82: Love, Ряд 83-85: Wink
  
  const rows = 86;
  const canvas = document.createElement('canvas');
  canvas.width = cols * FRAME_SIZE;
  canvas.height = rows * FRAME_SIZE;
  const ctx = canvas.getContext('2d')!;
  
  // Прозрачный фон
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const drawer = new CharacterDrawer(ctx, 0, 0);
  let currentRow = 0;

  // Idle анимация (4 кадра на направление)
  for (const dir of directions) {
    for (let f = 0; f < 4; f++) {
      const tempDrawer = new CharacterDrawer(ctx, 0, currentRow * FRAME_SIZE);
      tempDrawer.drawFrame(dir, f, 'idle');
      currentRow++;
    }
  }

  // Walk анимация (6 кадров на направление)
  for (const dir of directions) {
    for (let f = 0; f < 6; f++) {
      ctx.save();
      const tempDrawer = new CharacterDrawer(ctx, 0, currentRow * FRAME_SIZE);
      tempDrawer.drawFrame(dir, f, 'walk');
      ctx.restore();
      currentRow++;
    }
  }

  // Run анимация (6 кадров на направление)
  for (const dir of directions) {
    for (let f = 0; f < 6; f++) {
      ctx.save();
      const tempDrawer = new CharacterDrawer(ctx, 0, currentRow * FRAME_SIZE);
      tempDrawer.drawFrame(dir, f, 'run');
      ctx.restore();
      currentRow++;
    }
  }

  // Jump анимация (4 кадра, направление вниз)
  // Смещение обрабатывается динамически в GameEngine через jumpHeight
  for (let f = 0; f < 4; f++) {
    const tempDrawer = new CharacterDrawer(ctx, 0, currentRow * FRAME_SIZE);
    tempDrawer.drawFrame('down', f, 'jump');
    currentRow++;
  }

  // Эмоции (6 эмоций * 3 кадра)
  for (const emotion of emotions) {
    for (let f = 0; f < 3; f++) {
      ctx.save();
      const tempDrawer = new CharacterDrawer(ctx, 0, currentRow * FRAME_SIZE);
      tempDrawer.drawFrame('down', f, 'emotion', emotion);
      ctx.restore();
      currentRow++;
    }
  }

  return { canvas, ctx };
}

// Индексы кадров в спрайт-листе
export const FRAME_INDICES = {
  idle: {
    down: 0, up: 4, left: 8, right: 12,
    frameCounts: 4,
  },
  walk: {
    down: 16, up: 22, left: 28, right: 34,
    frameCounts: 6,
  },
  run: {
    down: 40, up: 46, left: 52, right: 58,
    frameCounts: 6,
  },
  jump: {
    start: 64,
    frameCounts: 4,
  },
  emotions: {
    happy: 68,
    sad: 71,
    angry: 74,
    surprised: 77,
    love: 80,
    wink: 83,
    frameCounts: 3,
  },
};
