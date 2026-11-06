import { useState } from 'react';
import { Controls } from './Controls.jsx';
import { Sensitivity } from './Sensitivity.jsx';

export function StartScreen({ onPlay }) {
  const [seed, setSeed] = useState('');
  return (
    <div className="screen start">
      <div className="start-hills" aria-hidden />
      <div className="panel start-panel">
        <h1 className="logo">OFFICECRAFT</h1>
        <p className="tagline">dig · build · survive the night</p>
        <label className="seed">
          <span>World seed (optional)</span>
          <input
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="random"
            onKeyDown={(e) => e.key === 'Enter' && onPlay(seed.trim())}
          />
        </label>
        <button className="btn" onClick={() => onPlay(seed.trim())} autoFocus>
          Play
        </button>
        <Sensitivity />
        <Controls />
      </div>
    </div>
  );
}
