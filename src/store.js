// Tiny shared store: the game engine writes, React reads.
import { useSyncExternalStore } from 'react';

function createStore(initial) {
  let state = initial;
  const subs = new Set();
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
      subs.forEach((f) => f());
    },
    subscribe(f) {
      subs.add(f);
      return () => subs.delete(f);
    },
  };
}

export const store = createStore({
  screen: 'menu',        // 'menu' | 'loading' | 'game'
  progress: 0,
  status: '',
  slots: Array(36).fill(null), // 0-8 hotbar, 9-35 backpack
  selected: 0,
  cursor: null,          // stack held by the mouse in the inventory
  inventoryOpen: false,
  locked: false,         // pointer lock active
  toast: null,           // { text, id }
  debug: null,
  underwater: false,
  flying: false,
  health: 20,            // half-hearts (20 = 10 hearts)
  hurtId: 0,             // increments on every hit (drives the red flash)
  dead: false,
  sensitivity: loadSensitivity(), // 0.2 – 3, multiplier on mouse look
  postfx: loadFlag('officecraft.postfx', true), // bloom + colour grading
});

function loadFlag(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

export function setPostfx(on) {
  store.set({ postfx: on });
  try { localStorage.setItem('officecraft.postfx', on ? '1' : '0'); } catch { /* ignore */ }
}

function loadSensitivity() {
  try {
    const v = parseFloat(localStorage.getItem('officecraft.sensitivity'));
    return v >= 0.2 && v <= 3 ? v : 1;
  } catch {
    return 1;
  }
}

export function setSensitivity(v) {
  store.set({ sensitivity: v });
  try { localStorage.setItem('officecraft.sensitivity', String(v)); } catch { /* ignore */ }
}

export function useStore(selector) {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}

let toastId = 0;
export function toast(text) {
  store.set({ toast: { text, id: ++toastId } });
}
