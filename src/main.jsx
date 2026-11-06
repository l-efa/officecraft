import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// No StrictMode: it would mount the game engine twice in dev.
createRoot(document.getElementById('root')).render(<App />);
