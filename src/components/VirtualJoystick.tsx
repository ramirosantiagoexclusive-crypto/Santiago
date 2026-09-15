import React, { useRef, useEffect, useState, useCallback } from 'react';

interface VirtualJoystickProps {
  onMove: (x: number, y: number) => void;
  onMoveEnd: () => void;
  size?: number;
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({
  onMove,
  onMoveEnd,
  size = 120,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const centerRef = useRef({ x: 0, y: 0 });

  const handleStart = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    centerRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    setActive(true);
    handleMove(clientX, clientY);
  }, []);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!active && !containerRef.current) return;
    
    const dx = clientX - centerRef.current.x;
    const dy = clientY - centerRef.current.y;
    const maxDist = size / 2 - 20;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    let nx = dx;
    let ny = dy;
    
    if (dist > maxDist) {
      nx = (dx / dist) * maxDist;
      ny = (dy / dist) * maxDist;
    }
    
    setPosition({ x: nx, y: ny });
    
    // Нормализуем для игры (-1 до 1)
    const normX = nx / maxDist;
    const normY = ny / maxDist;
    onMove(normX, normY);
  }, [active, size, onMove]);

  const handleEnd = useCallback(() => {
    setActive(false);
    setPosition({ x: 0, y: 0 });
    onMoveEnd();
  }, [onMoveEnd]);

  // Touch events
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      handleStart(touch.clientX, touch.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      handleEnd();
    };

    container.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [handleStart, handleMove, handleEnd]);

  // Mouse events (для тестирования на ПК)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let mouseDown = false;

    const onMouseDown = (e: MouseEvent) => {
      mouseDown = true;
      handleStart(e.clientX, e.clientY);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (mouseDown) {
        handleMove(e.clientX, e.clientY);
      }
    };

    const onMouseUp = () => {
      if (mouseDown) {
        mouseDown = false;
        handleEnd();
      }
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [handleStart, handleMove, handleEnd]);

  return (
    <div
      ref={containerRef}
      className="relative rounded-full border-2 border-white/30 bg-black/20 backdrop-blur-sm touch-none select-none"
      style={{ width: size, height: size }}
    >
      {/* Базовый круг */}
      <div className="absolute inset-0 rounded-full border border-white/10" />
      
      {/* Крестик-ориентир */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-px h-8 bg-white/20" />
        <div className="absolute w-8 h-px bg-white/20" />
      </div>
      
      {/* Ручка джойстика */}
      <div
        className={`absolute rounded-full transition-transform ${
          active ? 'bg-white/60 scale-110' : 'bg-white/40'
        }`}
        style={{
          width: 48,
          height: 48,
          left: '50%',
          top: '50%',
          transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
          boxShadow: active ? '0 0 20px rgba(255,255,255,0.3)' : 'none',
        }}
      />
    </div>
  );
};
