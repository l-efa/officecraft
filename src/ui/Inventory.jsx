import { useEffect, useState } from 'react';
import { useStore } from '../store.js';
import { clickSlot, HOTBAR, SIZE } from '../game/inventory.js';
import { itemName } from '../game/blocks.js';
import { Slot, ItemStack } from './Slot.jsx';

export function Inventory({ game }) {
  const slots = useStore((s) => s.slots);
  const cursor = useStore((s) => s.cursor);
  const [mouse, setMouse] = useState({ x: -100, y: -100 });

  useEffect(() => {
    const move = (e) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);

  const slotProps = (i) => ({
    item: slots[i],
    title: slots[i] ? itemName(slots[i].id) : undefined,
    onMouseDown: (e) => { e.preventDefault(); clickSlot(i, e.button, e.shiftKey); },
  });

  const backpack = [];
  for (let i = HOTBAR; i < SIZE; i++) backpack.push(<Slot key={i} {...slotProps(i)} />);

  return (
    <div className="screen inventory-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) game.current.closeInventory(true); }}>
      <div className="panel inventory">
        <div className="inv-head">
          <h2>Inventory</h2>
          <span className="hint">Click: pick up / drop · Right click: split · Shift click: quick move · E: close</span>
        </div>
        <div className="grid">{backpack}</div>
        <div className="grid hotrow">
          {Array.from({ length: HOTBAR }, (_, i) => <Slot key={i} {...slotProps(i)} />)}
        </div>
      </div>
      {cursor && (
        <div className="cursor-item" style={{ left: mouse.x, top: mouse.y }}>
          <ItemStack item={cursor} />
        </div>
      )}
    </div>
  );
}
