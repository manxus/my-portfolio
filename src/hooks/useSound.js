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

const SOUNDS = {
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
};

export function useSound() {
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const soundVolume = useSettingsStore((s) => s.soundVolume);
  const enabledRef = useRef(soundEnabled);

  useEffect(() => {
    enabledRef.current = soundEnabled;
    masterVolume = soundVolume;
  }, [soundEnabled, soundVolume]);

  const play = useCallback((soundName, ...args) => {
    if (!enabledRef.current) return;
    const fn = SOUNDS[soundName];
    if (fn) fn(...args);
  }, []);

  return { play };
}
