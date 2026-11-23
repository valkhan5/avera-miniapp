import { createRoot } from 'react-dom/client';
import '@brand/fonts.css';
import '@brand/tokens.css';
import './styles/app.css';
import { isMock, setupTelegram } from './telegram';
import { installMockTelegram } from './dev/mockTelegram';
import { StoreProvider } from './store';
import { App } from './App';

if (isMock) installMockTelegram();
setupTelegram();

createRoot(document.getElementById('root')!).render(
  <StoreProvider><App /></StoreProvider>,
);
