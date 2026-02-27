import { useRef, useEffect } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import styles from './MenuBackground.module.css';

const PARTICLE_COUNT = 40;
const BASE_MAX_SPEED = 0.3;
const PARTICLE_SIZE_MIN = 1;
const PARTICLE_SIZE_MAX = 2.5;

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

export default function MenuBackground() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const particlesEnabled = useSettingsStore((s) => s.particlesEnabled);
  const effectsEnabled = useSettingsStore((s) => s.effectsEnabled);
  const accentColor = useSettingsStore((s) => s.accentColor);
  const particleSpeed = useSettingsStore((s) => s.particleSpeed);
  const settingsRef = useRef({ accentColor, particleSpeed });

  useEffect(() => {
    settingsRef.current = { accentColor, particleSpeed };
  }, [accentColor, particleSpeed]);

  const visible = particlesEnabled && effectsEnabled;

  useEffect(() => {
    if (!visible) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width, height;
    const particles = [];

    function resize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }

    function createParticles() {
      particles.length = 0;
      const maxSpeed = BASE_MAX_SPEED * settingsRef.current.particleSpeed;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: randomBetween(-maxSpeed, maxSpeed),
          vy: randomBetween(-maxSpeed, maxSpeed),
          baseVx: 0,
          baseVy: 0,
          size: randomBetween(PARTICLE_SIZE_MIN, PARTICLE_SIZE_MAX),
          opacity: randomBetween(0.15, 0.4),
        });
        particles[i].baseVx = particles[i].vx;
        particles[i].baseVy = particles[i].vy;
      }
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      const rgb = hexToRgb(settingsRef.current.accentColor);
      const speed = settingsRef.current.particleSpeed;

      for (const p of particles) {
        p.x += p.baseVx * speed;
        p.y += p.baseVy * speed;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb}, ${p.opacity})`;
        ctx.fill();
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(${rgb}, ${0.06 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animRef.current = requestAnimationFrame(draw);
    }

    resize();
    createParticles();
    draw();

    const onResize = () => {
      resize();
      createParticles();
    };
    window.addEventListener('resize', onResize);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, [visible]);

  if (!visible) return null;

  return <canvas ref={canvasRef} className={styles.canvas} />;
}
