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

export type Direction = 'down' | 'up' | 'left' | 'right';
export type AnimationType = 'idle' | 'walk' | 'run' | 'jump' | 'emotion';
export type Emotion = 'happy' | 'sad' | 'angry' | 'surprised' | 'love' | 'wink';

interface SpriteSheet {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

// Класс для рисования персонажа с учётом направления
class CharacterDrawer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  // Рисуем персонажа в указанной позиции
  drawFrame(offsetX: number, offsetY: number, direction: Direction, animFrame: number, animType: AnimationType, emotion?: Emotion) {
    const ctx = this.ctx;

    ctx.save();
    ctx.translate(offsetX, offsetY);

    // Для направлений left/right применяем горизонтальное отражение
    if (direction === 'left') {
      ctx.translate(FRAME_SIZE, 0);
      ctx.scale(-1, 1);
      // Рисуем как right, но зеркально
      this.drawCharacter('right', animFrame, animType, emotion);
    } else {
      this.drawCharacter(direction, animFrame, animType, emotion);
    }

    ctx.restore();
  }

  private drawCharacter(direction: Direction, animFrame: number, animType: AnimationType, emotion?: Emotion) {
    const ctx = this.ctx;

    // Смещение для анимации
    let bobY = 0;
    let leanX = 0;
    let armSwing = 0;
    let legSwing = 0;

    if (animType === 'walk') {
      bobY = Math.sin(animFrame * Math.PI / 3) * 2;
      armSwing = Math.sin(animFrame * Math.PI / 3) * 10;
      legSwing = Math.sin(animFrame * Math.PI / 3) * 8;
    } else if (animType === 'run') {
      bobY = Math.sin(animFrame * Math.PI / 3) * 3;
      leanX = 2;
      armSwing = Math.sin(animFrame * Math.PI / 3) * 18;
      legSwing = Math.sin(animFrame * Math.PI / 3) * 14;
    } else if (animType === 'idle') {
      bobY = Math.sin(animFrame * Math.PI / 2) * 1;
    } else if (animType === 'jump') {
      if (animFrame === 0) {
        bobY = 4;
        legSwing = -3;
      } else if (animFrame === 1) {
        bobY = -2;
        armSwing = -20;
        legSwing = -2;
      } else if (animFrame === 2) {
        bobY = -4;
        armSwing = -15;
        legSwing = 3;
      } else {
        bobY = 2;
        legSwing = 2;
      }
    }

    ctx.save();
    ctx.translate(leanX, bobY);

    // Рисуем в зависимости от направления
    if (direction === 'down') {
      this.drawFront(armSwing, legSwing, emotion, animFrame);
    } else if (direction === 'up') {
      this.drawBack(armSwing, legSwing);
    } else if (direction === 'right') {
      this.drawSide(armSwing, legSwing, false, emotion);
    }

    ctx.restore();
  }

  // Вид спереди (down)
  private drawFront(armSwing: number, legSwing: number, emotion?: Emotion, animFrame?: number) {
    const ctx = this.ctx;

    // Ноги
    this.drawLegsFront(legSwing);
    // Ботинки
    this.drawBootsFront(legSwing);
    // Тело
    this.drawBodyFront();
    // Руки
    this.drawArmsFront(armSwing, emotion);
    // Голова
    this.drawHeadFront(emotion, animFrame);
  }

  // Вид сзади (up)
  private drawBack(armSwing: number, legSwing: number) {
    const ctx = this.ctx;

    // Ноги
    this.drawLegsFront(legSwing);
    // Ботинки
    this.drawBootsFront(legSwing);
    // Тело (спина)
    this.drawBodyBack();
    // Руки
    this.drawArmsFront(armSwing);
    // Голова (сзади - волосы)
    this.drawHeadBack();
  }

  // Вид сбоку (right, для left будет зеркально)
  private drawSide(armSwing: number, legSwing: number, mirror: boolean, emotion?: Emotion) {
    const ctx = this.ctx;

    // Ноги (одна видна)
    this.drawLegsSide(legSwing);
    // Ботинки
    this.drawBootsSide(legSwing);
    // Тело
    this.drawBodySide();
    // Рука (одна видна)
    this.drawArmsSide(armSwing, emotion);
    // Голова
    this.drawHeadSide(emotion);
  }

  // === НОГИ ===
  private drawLegsFront(swing: number) {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.pants;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1;

    // Левая нога
    ctx.beginPath();
    ctx.roundRect(26 - swing * 0.3, 44, 6, 10, 2);
    ctx.fill();
    ctx.stroke();

    // Правая нога
    ctx.beginPath();
    ctx.roundRect(34 + swing * 0.3, 44, 6, 10, 2);
    ctx.fill();
    ctx.stroke();

    // Тени
    ctx.fillStyle = COLORS.pantsDark;
    ctx.fillRect(27 - swing * 0.3, 46, 2, 6);
    ctx.fillRect(35 + swing * 0.3, 46, 2, 6);
  }

  private drawLegsSide(swing: number) {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.pants;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1;

    // Одна нога видна (задняя нога немного позади)
    ctx.beginPath();
    ctx.roundRect(29 - swing * 0.4, 44, 7, 10, 2);
    ctx.fill();
    ctx.stroke();

    // Тень
    ctx.fillStyle = COLORS.pantsDark;
    ctx.fillRect(30 - swing * 0.4, 46, 2, 6);
  }

  // === БОТИНКИ ===
  private drawBootsFront(swing: number) {
    const ctx = this.ctx;

    // Левый ботинок
    ctx.fillStyle = COLORS.boots;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(24 - swing * 0.3, 53, 8, 5, 2);
    ctx.fill();
    ctx.stroke();

    // Блик
    ctx.fillStyle = COLORS.bootsLight;
    ctx.fillRect(25 - swing * 0.3, 54, 3, 2);

    // Правый ботинок
    ctx.fillStyle = COLORS.boots;
    ctx.beginPath();
    ctx.roundRect(33 + swing * 0.3, 53, 8, 5, 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = COLORS.bootsLight;
    ctx.fillRect(34 + swing * 0.3, 54, 3, 2);
  }

  private drawBootsSide(swing: number) {
    const ctx = this.ctx;

    ctx.fillStyle = COLORS.boots;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(27 - swing * 0.4, 53, 9, 5, 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = COLORS.bootsLight;
    ctx.fillRect(28 - swing * 0.4, 54, 3, 2);
  }

  // === ТЕЛО ===
  private drawBodyFront() {
    const ctx = this.ctx;

    // Куртка
    ctx.fillStyle = COLORS.jacket;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(22, 28, 20, 18, 3);
    ctx.fill();
    ctx.stroke();

    // Тень справа
    ctx.fillStyle = COLORS.jacketDark;
    ctx.fillRect(37, 30, 4, 14);

    // Блик слева
    ctx.fillStyle = COLORS.jacketLight;
    ctx.fillRect(24, 30, 3, 12);

    // Молния
    ctx.strokeStyle = '#FCD34D';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(32, 30);
    ctx.lineTo(32, 44);
    ctx.stroke();

    // Застёжка
    ctx.fillStyle = '#FCD34D';
    ctx.beginPath();
    ctx.arc(32, 32, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Карманы
    ctx.strokeStyle = COLORS.jacketDark;
    ctx.lineWidth = 1;
    ctx.strokeRect(25, 38, 6, 5);
    ctx.strokeRect(33, 38, 6, 5);
  }

  private drawBodyBack() {
    const ctx = this.ctx;

    // Спина куртки
    ctx.fillStyle = COLORS.jacket;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(22, 28, 20, 18, 3);
    ctx.fill();
    ctx.stroke();

    // Тень по центру (шов)
    ctx.strokeStyle = COLORS.jacketDark;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(32, 30);
    ctx.lineTo(32, 44);
    ctx.stroke();

    // Капюшон (сзади)
    ctx.fillStyle = COLORS.jacketDark;
    ctx.beginPath();
    ctx.arc(32, 28, 6, Math.PI, 0);
    ctx.fill();
  }

  private drawBodySide() {
    const ctx = this.ctx;

    // Куртка сбоку
    ctx.fillStyle = COLORS.jacket;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(24, 28, 16, 18, 3);
    ctx.fill();
    ctx.stroke();

    // Тень
    ctx.fillStyle = COLORS.jacketDark;
    ctx.fillRect(36, 30, 3, 14);

    // Блик
    ctx.fillStyle = COLORS.jacketLight;
    ctx.fillRect(26, 30, 2, 12);
  }

  // === РУКИ ===
  private drawArmsFront(swing: number, emotion?: Emotion) {
    const ctx = this.ctx;

    let leftArmY = 30;
    let rightArmY = 30;

    if (emotion === 'happy' || emotion === 'surprised') {
      leftArmY = 22;
      rightArmY = 22;
    } else if (emotion === 'sad') {
      leftArmY = 36;
      rightArmY = 36;
    }

    // Левая рука
    ctx.save();
    ctx.translate(22, leftArmY);
    ctx.rotate((swing * Math.PI) / 180);
    ctx.fillStyle = COLORS.jacket;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-3, 0, 6, 14, 3);
    ctx.fill();
    ctx.stroke();
    // Кисть
    ctx.fillStyle = COLORS.skin;
    ctx.beginPath();
    ctx.arc(0, 14, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Правая рука
    ctx.save();
    ctx.translate(42, rightArmY);
    ctx.rotate((-swing * Math.PI) / 180);
    ctx.fillStyle = COLORS.jacket;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-3, 0, 6, 14, 3);
    ctx.fill();
    ctx.stroke();
    // Кисть
    ctx.fillStyle = COLORS.skin;
    ctx.beginPath();
    ctx.arc(0, 14, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  private drawArmsSide(swing: number, emotion?: Emotion) {
    const ctx = this.ctx;

    let armY = 30;
    if (emotion === 'happy' || emotion === 'surprised') {
      armY = 22;
    } else if (emotion === 'sad') {
      armY = 36;
    }

    // Одна рука видна
    ctx.save();
    ctx.translate(32, armY);
    ctx.rotate((swing * Math.PI) / 180);
    ctx.fillStyle = COLORS.jacket;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-3, 0, 6, 14, 3);
    ctx.fill();
    ctx.stroke();
    // Кисть
    ctx.fillStyle = COLORS.skin;
    ctx.beginPath();
    ctx.arc(0, 14, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  // === ГОЛОВА ===
  private drawHeadFront(emotion?: Emotion, animFrame?: number) {
    const ctx = this.ctx;

    // Шея
    ctx.fillStyle = COLORS.skin;
    ctx.fillRect(29, 26, 6, 4);

    // Голова
    ctx.fillStyle = COLORS.skin;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(32, 18, 13, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Румянец для love
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
    this.drawHairFront();

    // Лицо
    this.drawFaceFront(emotion);

    // Эффекты эмоций
    if (emotion === 'love') this.drawHearts();
    else if (emotion === 'sad') this.drawTears();
    else if (emotion === 'surprised') this.drawSurpriseMarks();
  }

  private drawHeadBack() {
    const ctx = this.ctx;

    // Шея
    ctx.fillStyle = COLORS.skin;
    ctx.fillRect(29, 26, 6, 4);

    // Голова (сзади - волосы закрывают)
    ctx.fillStyle = COLORS.hairDark;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(32, 16, 14, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Основная масса волос
    ctx.fillStyle = COLORS.hair;
    ctx.beginPath();
    ctx.ellipse(32, 14, 13, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Пряди сзади
    ctx.fillStyle = COLORS.hairDark;
    ctx.beginPath();
    ctx.moveTo(24, 20);
    ctx.quadraticCurveTo(22, 28, 26, 30);
    ctx.quadraticCurveTo(27, 25, 28, 20);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(36, 20);
    ctx.quadraticCurveTo(38, 28, 40, 30);
    ctx.quadraticCurveTo(39, 25, 38, 20);
    ctx.fill();

    // Блик
    ctx.fillStyle = COLORS.hairLight;
    ctx.beginPath();
    ctx.ellipse(28, 10, 5, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawHeadSide(emotion?: Emotion) {
    const ctx = this.ctx;

    // Шея
    ctx.fillStyle = COLORS.skin;
    ctx.fillRect(29, 26, 6, 4);

    // Голова сбоку
    ctx.fillStyle = COLORS.skin;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(32, 18, 11, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Волосы сбоку
    ctx.fillStyle = COLORS.hairDark;
    ctx.beginPath();
    ctx.ellipse(32, 14, 12, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.hair;
    ctx.beginPath();
    ctx.ellipse(32, 12, 11, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Челка сбоку
    ctx.beginPath();
    ctx.moveTo(22, 14);
    ctx.quadraticCurveTo(24, 20, 28, 18);
    ctx.quadraticCurveTo(30, 14, 32, 16);
    ctx.quadraticCurveTo(34, 12, 36, 14);
    ctx.quadraticCurveTo(38, 10, 40, 12);
    ctx.quadraticCurveTo(38, 6, 32, 5);
    ctx.quadraticCurveTo(24, 6, 22, 14);
    ctx.fill();

    // Блик
    ctx.fillStyle = COLORS.hairLight;
    ctx.beginPath();
    ctx.ellipse(28, 8, 4, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Глаз (один виден)
    ctx.fillStyle = COLORS.eyeWhite;
    ctx.beginPath();
    ctx.ellipse(36, 18, 3, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = COLORS.eyes;
    ctx.beginPath();
    ctx.ellipse(36, 18.5, 2, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(35, 17, 1, 0, Math.PI * 2);
    ctx.fill();

    // Рот сбоку
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(38, 24);
    ctx.lineTo(40, 24);
    ctx.stroke();

    // Нос сбоку
    ctx.fillStyle = COLORS.skinDark;
    ctx.beginPath();
    ctx.arc(40, 21, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawHairFront() {
    const ctx = this.ctx;

    // Основная масса волос
    ctx.fillStyle = COLORS.hairDark;
    ctx.beginPath();
    ctx.ellipse(32, 14, 14, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    // Верхняя часть
    ctx.fillStyle = COLORS.hair;
    ctx.beginPath();
    ctx.ellipse(32, 12, 13, 11, 0, -Math.PI, 0);
    ctx.fill();

    // Блик
    ctx.fillStyle = COLORS.hairLight;
    ctx.beginPath();
    ctx.ellipse(28, 8, 5, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Челка
    ctx.fillStyle = COLORS.hair;
    ctx.strokeStyle = COLORS.hairDark;
    ctx.lineWidth = 0.5;
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

    // Боковые пряди
    ctx.fillStyle = COLORS.hair;
    ctx.beginPath();
    ctx.moveTo(19, 14);
    ctx.quadraticCurveTo(17, 22, 20, 26);
    ctx.quadraticCurveTo(21, 22, 22, 18);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(45, 14);
    ctx.quadraticCurveTo(47, 22, 44, 26);
    ctx.quadraticCurveTo(43, 22, 42, 18);
    ctx.fill();

    // Контур
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(32, 12, 13, 11, 0, -Math.PI, 0);
    ctx.stroke();
  }

  private drawFaceFront(emotion?: Emotion) {
    const ctx = this.ctx;
    const eyeY = 18;
    const leftEyeX = 27;
    const rightEyeX = 37;

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
    } else if (emotion === 'surprised') {
      mouthType = 'open';
      eyeSize = 4;
    } else if (emotion === 'love') {
      mouthType = 'smile';
      eyeSize = 3.5;
    }

    // Левый глаз
    if (!leftEyeClosed) {
      ctx.fillStyle = COLORS.eyeWhite;
      ctx.beginPath();
      ctx.ellipse(leftEyeX, eyeY, eyeSize, eyeSize + 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.outline;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = COLORS.eyes;
      ctx.beginPath();
      ctx.ellipse(leftEyeX, eyeY + 0.5, eyeSize * 0.6, eyeSize * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(leftEyeX - 1, eyeY - 1, 1, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = COLORS.outline;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(leftEyeX - 3, eyeY);
      ctx.quadraticCurveTo(leftEyeX, eyeY + 2, leftEyeX + 3, eyeY);
      ctx.stroke();
    }

    // Правый глаз
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
      ctx.beginPath();
      ctx.moveTo(leftEyeX - 3, eyeY - 5);
      ctx.lineTo(leftEyeX + 2, eyeY - 7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rightEyeX + 3, eyeY - 5);
      ctx.lineTo(rightEyeX - 2, eyeY - 7);
      ctx.stroke();
    } else if (emotion === 'sad') {
      ctx.beginPath();
      ctx.moveTo(leftEyeX - 3, eyeY - 7);
      ctx.lineTo(leftEyeX + 2, eyeY - 5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rightEyeX + 3, eyeY - 7);
      ctx.lineTo(rightEyeX - 2, eyeY - 5);
      ctx.stroke();
    } else if (emotion === 'surprised') {
      ctx.beginPath();
      ctx.moveTo(leftEyeX - 3, eyeY - 7);
      ctx.lineTo(leftEyeX + 3, eyeY - 7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rightEyeX - 3, eyeY - 7);
      ctx.lineTo(rightEyeX + 3, eyeY - 7);
      ctx.stroke();
    } else {
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

    // Нос
    ctx.fillStyle = COLORS.skinDark;
    ctx.beginPath();
    ctx.arc(32, 21, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawHearts() {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.heart;

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
  const directions: Direction[] = ['down', 'up', 'left', 'right'];
  const emotions: Emotion[] = ['happy', 'sad', 'angry', 'surprised', 'love', 'wink'];

  const rows = 86;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = rows * FRAME_SIZE;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const drawer = new CharacterDrawer(ctx);
  let currentRow = 0;

  // Idle (4 кадра * 4 направления = 16)
  for (const dir of directions) {
    for (let f = 0; f < 4; f++) {
      drawer.drawFrame(0, currentRow * FRAME_SIZE, dir, f, 'idle');
      currentRow++;
    }
  }

  // Walk (6 кадров * 4 направления = 24)
  for (const dir of directions) {
    for (let f = 0; f < 6; f++) {
      drawer.drawFrame(0, currentRow * FRAME_SIZE, dir, f, 'walk');
      currentRow++;
    }
  }

  // Run (6 кадров * 4 направления = 24)
  for (const dir of directions) {
    for (let f = 0; f < 6; f++) {
      drawer.drawFrame(0, currentRow * FRAME_SIZE, dir, f, 'run');
      currentRow++;
    }
  }

  // Jump (4 кадра)
  for (let f = 0; f < 4; f++) {
    drawer.drawFrame(0, currentRow * FRAME_SIZE, 'down', f, 'jump');
    currentRow++;
  }

  // Emotions (6 эмоций * 3 кадра = 18)
  for (const emotion of emotions) {
    for (let f = 0; f < 3; f++) {
      drawer.drawFrame(0, currentRow * FRAME_SIZE, 'down', f, 'emotion', emotion);
      currentRow++;
    }
  }

  return { canvas, ctx };
}

export const FRAME_INDICES = {
  idle: { down: 0, up: 4, left: 8, right: 12, frameCounts: 4 },
  walk: { down: 16, up: 22, left: 28, right: 34, frameCounts: 6 },
  run: { down: 40, up: 46, left: 52, right: 58, frameCounts: 6 },
  jump: { start: 64, frameCounts: 4 },
  emotions: { happy: 68, sad: 71, angry: 74, surprised: 77, love: 80, wink: 83, frameCounts: 3 },
};
