import { useStore, setSensitivity, setPostfx } from '../store.js';

export function PostFxToggle() {
  const on = useStore((s) => s.postfx);
  return (
    <label className="sens" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
      <span>Bloom &amp; color grading</span>
      <input type="checkbox" checked={on} onChange={(e) => setPostfx(e.target.checked)} />
      <b>{on ? 'ON' : 'OFF'}</b>
    </label>
  );
}

export function Sensitivity() {
  const value = useStore((s) => s.sensitivity);
  return (
    // stopPropagation so dragging the slider doesn't trigger "click to play"
    <label className="sens" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
      <span>Mouse sensitivity</span>
      <input
        type="range"
        min="0.2"
        max="3"
        step="0.05"
        value={value}
        onChange={(e) => setSensitivity(parseFloat(e.target.value))}
      />
      <b>{Math.round(value * 100)}%</b>
    </label>
  );
}
