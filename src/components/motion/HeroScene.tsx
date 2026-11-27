import { useEffect, useRef } from 'react';

// Logo palette only: emerald, teal, cyan (+ slate for faint links).
const COLORS: Array<[number, number, number]> = [
  [16, 185, 129],
  [20, 184, 166],
  [6, 182, 212],
];

type Point = { x: number; y: number; z: number; c: number; s: number };

function fibonacciSphere(count: number): Point[] {
  const points: Point[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = golden * i;
    points.push({ x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius, c: i % 3, s: 0.6 + ((i * 7) % 10) / 10 });
  }
  return points;
}

/**
 * A real-time 3D globe of points (projected on a 2D canvas, no WebGL dependency).
 * Rotates on its own and leans toward the pointer. Same scene as www.kelyani.com.
 */
export function HeroScene({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const small = window.matchMedia('(max-width: 640px)').matches;
    const points = fibonacciSphere(small ? 420 : 900);
    const orbit = Array.from({ length: small ? 60 : 120 }, (_, i) => ({ a: (i / (small ? 60 : 120)) * Math.PI * 2, r: 1.38 + (i % 3) * 0.06, c: i % 3 }));

    let width = 0;
    let height = 0;
    let dpr = 1;
    let rotY = 0;
    let rotX = -0.25;
    let targetTiltX = 0;
    let targetTiltY = 0;
    let tiltX = 0;
    let tiltY = 0;
    let frame = 0;
    let visible = true;
    const scrollFade = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      frame = 0;
      if (!visible) return;
      ctx.clearRect(0, 0, width, height);
      tiltX += (targetTiltX - tiltX) * 0.05;
      tiltY += (targetTiltY - tiltY) * 0.05;
      if (!reduced) rotY += 0.0022;

      const radius = small ? Math.min(width, height) * 0.46 : Math.min(width * 0.36, height * 0.62);
      const cx = width / 2;
      const cy = height * (small ? 0.4 : 0.5);
      const ax = rotX + tiltY * 0.35;
      const ay = rotY + tiltX * 0.5;
      const cosX = Math.cos(ax);
      const sinX = Math.sin(ax);
      const cosY = Math.cos(ay);
      const sinY = Math.sin(ay);
      const perspective = 2.6;

      const project = (x: number, y: number, z: number) => {
        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;
        const y1 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;
        const k = perspective / (perspective + z2);
        return { sx: cx + x1 * radius * k, sy: cy + y1 * radius * k, depth: z2, k };
      };

      // Core glow
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.5);
      glow.addColorStop(0, `rgba(16,185,129,${0.16 * scrollFade})`);
      glow.addColorStop(0.45, `rgba(6,182,212,${0.06 * scrollFade})`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      // Sphere points, far ones first
      const projected = points.map((p) => ({ p, ...project(p.x, p.y, p.z) })).sort((a, b) => b.depth - a.depth);
      for (const item of projected) {
        const front = (1 - item.depth) / 2; // 0 back .. 1 front
        const [r, g, b] = COLORS[item.p.c];
        const alpha = (0.06 + front * 0.42) * scrollFade;
        const size = (0.5 + front * 1.4) * item.p.s * item.k;
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.beginPath();
        ctx.arc(item.sx, item.sy, size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Tilted orbit ring of "loyalty stamps"
      const t = rotY * 2.4;
      for (const o of orbit) {
        const a = o.a + t;
        const x = Math.cos(a) * o.r;
        const z = Math.sin(a) * o.r;
        const y = Math.sin(a) * 0.22;
        const pr = project(x, y, z);
        const front = (1 - pr.depth / o.r) / 2;
        const [r, g, b] = COLORS[o.c];
        ctx.fillStyle = `rgba(${r},${g},${b},${(0.08 + front * 0.6) * scrollFade})`;
        ctx.beginPath();
        ctx.arc(pr.sx, pr.sy, (0.8 + front * 1.6) * pr.k, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduced) frame = requestAnimationFrame(draw);
    };

    const onPointer = (event: PointerEvent) => {
      targetTiltX = (event.clientX / window.innerWidth) * 2 - 1;
      targetTiltY = (event.clientY / window.innerHeight) * 2 - 1;
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !frame) frame = requestAnimationFrame(draw);
    });
    observer.observe(canvas);
    resize();
    frame = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointer, { passive: true });
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointer);
    };
  }, []);

  return <canvas ref={canvasRef} className={'ky-hero-scene ' + className} aria-hidden="true" />;
}
