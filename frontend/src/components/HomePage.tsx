'use client';

import CartWidget from './cart/CartWidget';
import Header from './common/Header';
import PromoBanner from './menu/PromoBanner';
import MenuSection from './menu/MenuSection';
import AuthModal from './auth/AuthModal';

export default function HomePage() {
  return (
    <div className="app">
      <Header />
      <main className="main">
        <PromoBanner />
        <MenuSection />
      </main>
      <CartWidget />
      <AuthModal />
    </div>
  );
}
