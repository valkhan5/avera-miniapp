import { lazy, Suspense } from 'react';
import { useStore } from './store';
import { useRoute } from './router';
import { Home } from './screens/Home';
import { ProductScreen } from './screens/Product';
import { ErrorScreen, Loading, OpenInTelegram } from './screens/Status';

const Cart = lazy(() => import('./screens/Cart'));
const Checkout = lazy(() => import('./screens/Checkout'));
const Done = lazy(() => import('./screens/Done'));
const Orders = lazy(() => import('./screens/Orders'));
const OrderDetail = lazy(() => import('./screens/OrderDetail'));
const Game = lazy(() => import('./screens/Game'));

export function App() {
  const { status } = useStore();
  const [screen, arg] = useRoute();
  if (status === 'outside') return <OpenInTelegram />;
  if (status === 'loading') return <Loading />;
  if (status === 'error') return <ErrorScreen />;
  return (
    <Suspense fallback={<Loading />}>
      {screen === 'p' && arg ? <ProductScreen slug={arg} />
        : screen === 'cart' ? <Cart />
        : screen === 'checkout' ? <Checkout />
        : screen === 'done' && arg ? <Done id={arg} />
        : screen === 'orders' && arg ? <OrderDetail id={arg} />
        : screen === 'orders' ? <Orders />
        : screen === 'game' ? <Game />
        : <Home />}
    </Suspense>
  );
}
