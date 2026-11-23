import { createRoot } from 'react-dom/client';
import '@brand/fonts.css';
import '@brand/tokens.css';
import './styles.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App />);
