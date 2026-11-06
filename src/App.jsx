import { useEffect, useRef } from 'react';
import { Game } from './game/Game.js';
import { useStore } from './store.js';
import { StartScreen } from './ui/StartScreen.jsx';
import { LoadingScreen } from './ui/LoadingScreen.jsx';
import { Hud } from './ui/Hud.jsx';

export default function App() {
  const mount = useRef(null);
  const game = useRef(null);
  const screen = useStore((s) => s.screen);

  useEffect(() => {
    const g = new Game(mount.current);
    game.current = g;
    if (import.meta.env.DEV) window.__game = g; // handy for debugging in the console
    return () => g.dispose();
  }, []);

  return (
    <>
      <div ref={mount} className="game-root" />
      {screen === 'menu' && <StartScreen onPlay={(seed) => game.current.start(seed)} />}
      {screen === 'loading' && <LoadingScreen />}
      {screen === 'game' && <Hud game={game} />}
    </>
  );
}
