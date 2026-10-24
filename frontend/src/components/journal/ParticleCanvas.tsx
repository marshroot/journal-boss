import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';

export interface ParticleCanvasHandle {
  burst: (x: number, y: number, colorPreset?: 'gems' | 'coins' | 'rainbow') => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  shape: 'circle' | 'square' | 'star' | 'diamond';
  rotation: number;
  rotationSpeed: number;
  alpha: number;
}

export const ParticleCanvas = forwardRef<ParticleCanvasHandle, {}>((_, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    // Register a global trigger on the window object
    (window as any).triggerCelebration = (x: number, y: number, preset?: 'gems' | 'coins' | 'rainbow') => {
      burstAction(x, y, preset);
    };

    return () => {
      window.removeEventListener('resize', handleResize);
      delete (window as any).triggerCelebration;
    };
  }, []);

  const drawStar = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    spikes: number,
    outerRadius: number,
    innerRadius: number,
    color: string,
    alpha: number
  ) => {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  };

  const drawDiamond = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number,
    color: string,
    alpha: number,
    rotation: number
  ) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.75, 0);
    ctx.lineTo(0, size);
    ctx.lineTo(-size * 0.75, 0);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  };

  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const particles = particlesRef.current;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vx *= 0.95; // Friction
      p.vy += 0.22;  // Gravity
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      p.alpha -= 0.015; // Fade out

      if (p.alpha <= 0) {
        particles.splice(i, 1);
        continue;
      }

      if (p.shape === 'star') {
        drawStar(ctx, p.x, p.y, 5, p.size, p.size / 2, p.color, p.alpha);
      } else if (p.shape === 'diamond') {
        drawDiamond(ctx, p.x, p.y, p.size, p.color, p.alpha, p.rotation);
      } else if (p.shape === 'circle') {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.restore();
      } else {
        // Square Confetti
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
    }

    if (particles.length > 0) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      animationFrameRef.current = null;
    }
  };

  const burstAction = (x: number, y: number, colorPreset: 'gems' | 'coins' | 'rainbow' = 'rainbow') => {
    const count = 35;
    let colors = ['#30ff44', '#00ffc2', '#7dffc4', '#ffeb3b', '#00ffc2'];
    if (colorPreset === 'gems') colors = ['#30ff44', '#00ffc2', '#7dffc4', '#ffffff'];
    if (colorPreset === 'coins') colors = ['#7dffc4', '#7dffc4', '#7dffc4', '#ffffff'];

    const shapes: Array<'circle' | 'square' | 'star' | 'diamond'> = ['circle', 'square', 'star', 'diamond'];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 7 + 3;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2, // Slightly upward push
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 5,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.25,
        alpha: 1,
      });
    }

    if (!animationFrameRef.current) {
      animate();
    }
  };

  useImperativeHandle(ref, () => ({
    burst(x, y, colorPreset) {
      burstAction(x, y, colorPreset);
    },
  }));

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  );
});

ParticleCanvas.displayName = 'ParticleCanvas';
