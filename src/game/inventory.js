// Inventory rules: 36 slots, stacks of 64, a few infinite stacks, tools stack to 1.
import { store } from '../store.js';
import { PICKAXE, SWORD, PLANKS, COBBLE, GLASS, BRICK, maxStack } from './blocks.js';

export const HOTBAR = 9;
export const SIZE = 36;

export function defaultSlots() {
  const s = Array(SIZE).fill(null);
  s[0] = { id: PICKAXE, count: 1 };
  s[1] = { id: SWORD, count: 1 };
  s[2] = { id: PLANKS, count: 1, inf: true };
  s[3] = { id: COBBLE, count: 1, inf: true };
  s[4] = { id: GLASS, count: 1, inf: true };
  s[5] = { id: BRICK, count: 1, inf: true };
  return s;
}

const stackable = (a, b) => a && b && a.id === b.id && !a.inf && !b.inf && maxStack(a.id) > 1;

/** Adds items, returns how many didn't fit. */
export function addItem(id, n = 1) {
  const slots = store.get().slots.slice();
  let left = n;
  const max = maxStack(id);
  for (let i = 0; i < SIZE && left; i++) {
    const s = slots[i];
    if (s && s.id === id && !s.inf && s.count < max) {
      const add = Math.min(left, max - s.count);
      slots[i] = { ...s, count: s.count + add };
      left -= add;
    }
  }
  for (let i = 0; i < SIZE && left; i++) {
    if (!slots[i]) {
      const add = Math.min(left, max);
      slots[i] = { id, count: add };
      left -= add;
    }
  }
  store.set({ slots });
  return left;
}

export function consumeSelected() {
  const { slots, selected } = store.get();
  const s = slots[selected];
  if (!s || s.inf) return;
  const ns = slots.slice();
  ns[selected] = s.count > 1 ? { ...s, count: s.count - 1 } : null;
  store.set({ slots: ns });
}

export function clickSlot(i, button, shift) {
  let { slots, cursor } = store.get();
  slots = slots.slice();
  const s = slots[i];

  // shift-click: move between hotbar and backpack
  if (shift && s && !cursor) {
    const [a, b] = i < HOTBAR ? [HOTBAR, SIZE] : [0, HOTBAR];
    let item = { ...s };
    for (let j = a; j < b && item.count > 0; j++) {
      const t = slots[j];
      if (stackable(t, item) && t.count < maxStack(t.id)) {
        const add = Math.min(item.count, maxStack(t.id) - t.count);
        slots[j] = { ...t, count: t.count + add };
        item.count -= add;
      }
    }
    for (let j = a; j < b && item.count > 0; j++) {
      if (!slots[j]) { slots[j] = item; item = { ...item, count: 0 }; }
    }
    slots[i] = item.count > 0 ? item : null;
    store.set({ slots });
    return;
  }

  if (button === 0) {
    if (!cursor) { if (s) { cursor = s; slots[i] = null; } }
    else if (!s) { slots[i] = cursor; cursor = null; }
    else if (stackable(s, cursor)) {
      const add = Math.min(cursor.count, maxStack(s.id) - s.count);
      slots[i] = { ...s, count: s.count + add };
      cursor = cursor.count - add > 0 ? { ...cursor, count: cursor.count - add } : null;
    } else { slots[i] = cursor; cursor = s; }
  } else if (button === 2) {
    if (!cursor) {
      if (s) {
        if (s.inf || s.count === 1) { cursor = s; slots[i] = null; }
        else {
          const half = Math.ceil(s.count / 2);
          cursor = { ...s, count: half };
          slots[i] = { ...s, count: s.count - half };
        }
      }
    } else if (!s) {
      if (cursor.inf || cursor.count === 1) { slots[i] = cursor; cursor = null; }
      else { slots[i] = { ...cursor, count: 1 }; cursor = { ...cursor, count: cursor.count - 1 }; }
    } else if (stackable(s, cursor) && s.count < maxStack(s.id)) {
      slots[i] = { ...s, count: s.count + 1 };
      cursor = cursor.count > 1 ? { ...cursor, count: cursor.count - 1 } : null;
    }
  }
  store.set({ slots, cursor });
}

/** Put whatever the mouse is holding back into the inventory. */
export function returnCursor() {
  const { cursor } = store.get();
  if (!cursor) return;
  store.set({ cursor: null });
  if (cursor.inf || cursor.id >= 100) {
    const slots = store.get().slots.slice();
    const j = slots.indexOf(null);
    if (j >= 0) { slots[j] = cursor; store.set({ slots }); }
  } else addItem(cursor.id, cursor.count);
}
