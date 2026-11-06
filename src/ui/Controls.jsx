const ROWS = [
  ['WASD', 'Move'],
  ['Mouse', 'Look around'],
  ['Space', 'Jump / swim'],
  ['Shift', 'Sprint'],
  ['Space ×3', 'Toggle flying'],
  ['Left click', 'Mine (pickaxe) / attack (sword)'],
  ['Right click', 'Place block'],
  ['1–9 / Wheel', 'Select hotbar slot'],
  ['E', 'Inventory'],
  ['T (hold)', 'Fast-forward time'],
  ['Esc', 'Pause'],
];

export function Controls() {
  return (
    <div className="controls">
      {ROWS.map(([k, v]) => (
        <div key={k} className="ctl">
          <kbd>{k}</kbd>
          <span>{v}</span>
        </div>
      ))}
    </div>
  );
}
