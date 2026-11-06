import { itemIcon } from '../game/textures.js';

export function ItemStack({ item }) {
  if (!item) return null;
  return (
    <>
      <img className="icon" src={itemIcon(item.id)} draggable={false} alt="" />
      {item.inf ? <span className="count inf">∞</span> : item.count > 1 ? <span className="count">{item.count}</span> : null}
    </>
  );
}

export function Slot({ item, selected, onMouseDown, title }) {
  return (
    <div className={`slot${selected ? ' sel' : ''}`} onMouseDown={onMouseDown} title={title}>
      <ItemStack item={item} />
    </div>
  );
}
