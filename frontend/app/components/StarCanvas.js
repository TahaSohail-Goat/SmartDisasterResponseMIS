'use client';
import { useEffect, useRef } from 'react';

export default function StarCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let stars = [];
    let mouse = { x: 0, y: 0 };

    const numStars = 700;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    const initStars = () => {
      stars = [];
      for (let i = 0; i < numStars; i++) {
        const layer = Math.random() < 0.6 ? 1 : Math.random() < 0.7 ? 2 : 3; // 3 depth layers
        stars.push({
          x: (Math.random() - 0.5) * 3000,
          y: (Math.random() - 0.5) * 3000,
          z: Math.random() * 2000,
          pz: 0,
          layer,
          // Color: 95% white, 5% aqua-tinted
          color: Math.random() < 0.05 ? `rgba(6, 182, 212,` : `rgba(255, 255, 255,`,
        });
        stars[i].pz = stars[i].z;
      }
    };

    // Nebula blobs: slow-drifting large soft glows
    const nebulas = [
      { x: width * 0.2, y: height * 0.3, vx: 0.05, vy: 0.03, r: 350, color: 'rgba(14, 165, 233,' },
      { x: width * 0.8, y: height * 0.7, vx: -0.04, vy: 0.05, r: 280, color: 'rgba(6, 182, 212,' },
      { x: width * 0.5, y: height * 0.9, vx: 0.06, vy: -0.04, r: 320, color: 'rgba(59,130,246,' },
    ];

    const drawNebulas = () => {
      nebulas.forEach(n => {
        n.x += n.vx;
        n.y += n.vy;
        // Wrap around
        if (n.x < -n.r) n.x = width + n.r;
        if (n.x > width + n.r) n.x = -n.r;
        if (n.y < -n.r) n.y = height + n.r;
        if (n.y > height + n.r) n.y = -n.r;

        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        grad.addColorStop(0, n.color + '0.04)');
        grad.addColorStop(1, n.color + '0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    const draw = () => {
      ctx.fillStyle = 'rgba(3, 3, 3, 0.18)';
      ctx.fillRect(0, 0, width, height);

      // Draw nebulas first (behind stars)
      drawNebulas();

      const cx = width / 2;
      const cy = height / 2;

      // Mouse parallax offset per layer
      const mx = (mouse.x - width / 2) * 0.0015;
      const my = (mouse.y - height / 2) * 0.0015;

      stars.forEach(star => {
        star.pz = star.z;
        // Faster movement for front layers
        const speed = star.layer === 1 ? 1 : star.layer === 2 ? 1.8 : 3;
        star.z -= speed;

        if (star.z < 1) {
          star.z = 2000;
          star.pz = 2000;
          star.x = (Math.random() - 0.5) * 3000;
          star.y = (Math.random() - 0.5) * 3000;
        }

        const fov = 300;
        const parallaxStrength = star.layer * 0.6; // Front layers shift more with mouse

        const sx = (star.x / star.z) * fov + cx + mx * parallaxStrength * 60;
        const sy = (star.y / star.z) * fov + cy + my * parallaxStrength * 60;
        const px = (star.x / star.pz) * fov + cx + mx * parallaxStrength * 60;
        const py = (star.y / star.pz) * fov + cy + my * parallaxStrength * 60;

        if (sx < 0 || sx > width || sy < 0 || sy > height) return;

        const depth = 1 - star.z / 2000;
        const radius = Math.max(0.1, depth * (star.layer === 3 ? 3 : 2));
        const opacity = Math.max(0.05, depth * 0.9);

        // Draw motion trail
        ctx.beginPath();
        ctx.strokeStyle = star.color + opacity + ')';
        ctx.lineWidth = radius;
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.stroke();

        // Draw glowing core for close / front-layer stars
        if (star.z < 400 || star.layer === 3) {
          ctx.beginPath();
          ctx.arc(sx, sy, radius * 2, 0, Math.PI * 2);
          ctx.fillStyle = star.layer === 3
            ? `rgba(6, 182, 212, ${opacity * 0.6})`
            : star.color + (opacity * 0.5) + ')';
          ctx.fill();
        }
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    const onMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    resize();
    initStars();
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

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
        zIndex: -2,
        mixBlendMode: 'screen',
      }}
    />
  );
}
