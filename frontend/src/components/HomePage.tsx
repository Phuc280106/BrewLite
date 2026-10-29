'use client';

import CartWidget from './cart/CartWidget';
import Header from './common/Header';
import PromoBanner from './menu/PromoBanner';
import MenuSection from './menu/MenuSection';
import AuthModal from './auth/AuthModal';
import OrderHistoryPage from './orders/OrderHistoryPage';
import BaristaBoard from './barista/BaristaBoard';
import { useViewStore } from '../store/useViewStore';
import { useAuthStore } from '../store/useAuthStore';

export default function HomePage() {
  const currentView = useViewStore((state) => state.currentView);
  const setCurrentView = useViewStore((state) => state.setCurrentView);
  const user = useAuthStore((state) => state.user);

  const isBarista =
    user?.role === 'BARISTA' ||
    user?.email?.toLowerCase().includes('barista') ||
    user?.name?.toLowerCase().includes('barista');

  if (currentView === 'orders') {
    return <OrderHistoryPage />;
  }

  if (currentView === 'barista') {
    return <BaristaBoard />;
  }

  return (
    <div className="app">
      <Header />
      {isBarista && (
        <aside className="w-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-white shadow-md">
          <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <span className="text-2xl">☕</span>
              <div>
                <p className="font-extrabold text-sm sm:text-base leading-tight">
                  Tài khoản Barista: {user?.name || user?.email}
                </p>
                <p className="text-amber-100 text-xs mt-0.5">
                  Nhận đơn và cập nhật trạng thái pha chế tại màn hình Barista KDS.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCurrentView('barista')}
              className="w-full sm:w-auto px-4 py-2 bg-stone-900 hover:bg-black text-amber-300 font-bold text-xs rounded-full transition-all shadow text-center whitespace-nowrap active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer border-none"
            >
              <span>Vào màn hình Barista</span>
              <span>→</span>
            </button>
          </div>
        </aside>
      )}
      <main className="main">
        <PromoBanner />
        <MenuSection />
      </main>
      <CartWidget />
      <AuthModal />
    </div>
  );
}
