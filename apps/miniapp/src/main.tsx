import { createRoot } from 'react-dom/client';
import '@brand/fonts.css';
import '@brand/tokens.css';
import './styles/app.css';
import { isMock, setupTelegram } from './telegram';
import { StoreProvider } from './store';
import { App } from './App';

function start() {
  setupTelegram();
  createRoot(document.getElementById('root')!).render(<StoreProvider><App /></StoreProvider>);
}

if (isMock) void import('./dev/mockTelegram').then((m) => { m.installMockTelegram(); start(); });
else start();
