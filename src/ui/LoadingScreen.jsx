import { useStore } from '../store.js';

export function LoadingScreen() {
  const progress = useStore((s) => s.progress);
  const status = useStore((s) => s.status);
  return (
    <div className="screen loading">
      <div className="loading-box">
        <h2>Generating world</h2>
        <div className="bar">
          <div className="bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <p>{status} {Math.round(progress * 100)}%</p>
      </div>
    </div>
  );
}
