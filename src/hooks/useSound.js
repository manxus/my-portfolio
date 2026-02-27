import { useCallback, useRef, useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

let audioCtx = null;
let masterVolume = 0.5;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(frequency, duration, relativeVol = 1, type = 'sine') {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const vol = relativeVol * masterVolume * 0.15;

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playNoise(duration, relativeVol = 1) {
  const ctx = getAudioContext();
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.5;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 4000;
  bandpass.Q.value = 0.5;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(relativeVol * masterVolume * 0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  source.connect(bandpass);
  bandpass.connect(gain);
  gain.connect(ctx.destination);
  source.start(ctx.currentTime);
  source.stop(ctx.currentTime + duration);
}

function playDetunedChord(freq, duration, vol = 0.5) {
  const ctx = getAudioContext();
  const detunes = [-8, 0, 8];
  for (const d of detunes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.detune.setValueAtTime(d, ctx.currentTime);
    gain.gain.setValueAtTime(vol * masterVolume * 0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }
}

const SOUND_THEMES = {
  default: {
    hover: () => playTone(800, 0.06, 0.5, 'sine'),
    click: () => playTone(600, 0.1, 0.7, 'square'),
    select: () => {
      playTone(500, 0.08, 0.6, 'sine');
      setTimeout(() => playTone(700, 0.12, 0.5, 'sine'), 60);
    },
    back: () => playTone(400, 0.12, 0.5, 'sine'),
    expand: () => playTone(600, 0.08, 0.5, 'triangle'),
    collapse: () => playTone(450, 0.08, 0.4, 'triangle'),
    error: () => playTone(200, 0.2, 0.6, 'sawtooth'),
    boot: (i) => playTone(300 + i * 50, 0.04, 0.3, 'square'),
    bootDone: () => {
      playTone(500, 0.15, 0.6, 'sine');
      setTimeout(() => playTone(700, 0.15, 0.5, 'sine'), 120);
      setTimeout(() => playTone(900, 0.2, 0.4, 'sine'), 240);
    },
  },

  retro: {
    hover: () => playTone(1200, 0.03, 0.4, 'square'),
    click: () => playTone(800, 0.05, 0.7, 'square'),
    select: () => {
      playTone(660, 0.05, 0.6, 'square');
      setTimeout(() => playTone(880, 0.07, 0.5, 'square'), 50);
    },
    back: () => playTone(330, 0.08, 0.5, 'square'),
    expand: () => playTone(440, 0.04, 0.5, 'square'),
    collapse: () => playTone(330, 0.04, 0.4, 'square'),
    error: () => {
      playTone(150, 0.1, 0.6, 'square');
      setTimeout(() => playTone(100, 0.15, 0.5, 'square'), 80);
    },
    boot: (i) => playTone(200 + i * 80, 0.03, 0.3, 'square'),
    bootDone: () => {
      playTone(523, 0.08, 0.5, 'square');
      setTimeout(() => playTone(659, 0.08, 0.5, 'square'), 80);
      setTimeout(() => playTone(784, 0.12, 0.6, 'square'), 160);
    },
  },

  mechanical: {
    hover: () => playNoise(0.02, 0.3),
    click: () => {
      playNoise(0.04, 0.7);
      playTone(3000, 0.02, 0.3, 'sine');
    },
    select: () => {
      playNoise(0.05, 0.6);
      playTone(1200, 0.04, 0.3, 'triangle');
    },
    back: () => playNoise(0.06, 0.4),
    expand: () => {
      playNoise(0.03, 0.4);
      playTone(800, 0.03, 0.2, 'triangle');
    },
    collapse: () => {
      playNoise(0.03, 0.3);
      playTone(600, 0.03, 0.2, 'triangle');
    },
    error: () => {
      playNoise(0.15, 0.5);
      playTone(200, 0.12, 0.3, 'sawtooth');
    },
    boot: (i) => {
      playNoise(0.02, 0.2);
      playTone(400 + i * 30, 0.02, 0.15, 'triangle');
    },
    bootDone: () => {
      playNoise(0.06, 0.5);
      playTone(1000, 0.1, 0.4, 'triangle');
    },
  },

  soft: {
    hover: () => playTone(600, 0.12, 0.2, 'sine'),
    click: () => playTone(440, 0.15, 0.3, 'sine'),
    select: () => {
      playTone(396, 0.12, 0.3, 'sine');
      setTimeout(() => playTone(528, 0.18, 0.25, 'sine'), 100);
    },
    back: () => playTone(330, 0.2, 0.25, 'sine'),
    expand: () => playTone(500, 0.15, 0.2, 'sine'),
    collapse: () => playTone(400, 0.15, 0.18, 'sine'),
    error: () => playTone(220, 0.3, 0.25, 'sine'),
    boot: (i) => playTone(250 + i * 30, 0.06, 0.15, 'sine'),
    bootDone: () => {
      playTone(396, 0.2, 0.3, 'sine');
      setTimeout(() => playTone(528, 0.2, 0.25, 'sine'), 180);
      setTimeout(() => playTone(660, 0.3, 0.2, 'sine'), 360);
    },
  },

  scifi: {
    hover: () => playDetunedChord(900, 0.08, 0.4),
    click: () => {
      playDetunedChord(600, 0.12, 0.6);
      playTone(1800, 0.04, 0.2, 'sine');
    },
    select: () => {
      playDetunedChord(500, 0.1, 0.5);
      setTimeout(() => playDetunedChord(750, 0.15, 0.4), 80);
    },
    back: () => {
      playDetunedChord(400, 0.15, 0.4);
      playTone(200, 0.1, 0.15, 'sawtooth');
    },
    expand: () => playDetunedChord(650, 0.1, 0.4),
    collapse: () => playDetunedChord(450, 0.1, 0.3),
    error: () => {
      playDetunedChord(180, 0.25, 0.5);
      playTone(120, 0.2, 0.3, 'sawtooth');
    },
    boot: (i) => playDetunedChord(300 + i * 40, 0.05, 0.25),
    bootDone: () => {
      playDetunedChord(500, 0.2, 0.5);
      setTimeout(() => playDetunedChord(700, 0.2, 0.4), 150);
      setTimeout(() => playDetunedChord(1000, 0.3, 0.35), 300);
    },
  },
};

export { SOUND_THEMES };

export function useSound() {
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const soundVolume = useSettingsStore((s) => s.soundVolume);
  const soundTheme = useSettingsStore((s) => s.soundTheme);
  const enabledRef = useRef(soundEnabled);
  const themeRef = useRef(soundTheme);

  useEffect(() => {
    enabledRef.current = soundEnabled;
    masterVolume = soundVolume;
    themeRef.current = soundTheme;
  }, [soundEnabled, soundVolume, soundTheme]);

  const play = useCallback((soundName, ...args) => {
    if (!enabledRef.current) return;
    const theme = SOUND_THEMES[themeRef.current] || SOUND_THEMES.default;
    const fn = theme[soundName];
    if (fn) fn(...args);
  }, []);

  return { play };
}
