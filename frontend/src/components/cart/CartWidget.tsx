'use client';

import { useEffect, useState } from 'react';
import CartBottomBar from './CartBottomBar';
import CartDrawer from './CartDrawer';
import { useCartStore } from './useCartStore';
import { useAuthStore } from '@/store/useAuthStore';
import PaymentModal from '../payment/PaymentModal';

export default function CartWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);
  const cart = useCartStore((state) => state.cart);
  const toastMessage = useCartStore((state) => state.toastMessage);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const clearCart = useCartStore((state) => state.clearCart);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  useEffect(() => {
    void useCartStore.persist.rehydrate();
  }, []);

  const handleCheckout = () => {
    if (cart.length === 0) return;

    if (!user) {
      setIsOpen(false);
      openAuthModal('login', 'Vui lòng đăng nhập để tiến hành thanh toán');
      return;
    }

    setIsOpen(false);
    setIsPaymentOpen(true);
  };

  return (
    <>
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-stone-900/95 backdrop-blur-md text-white text-xs sm:text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl border border-stone-700 flex items-center gap-2.5 animate-fadeIn">
          <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
            ✓
          </span>
          {toastMessage}
        </div>
      )}

      <CartBottomBar
        count={cartCount}
        total={cartTotal}
        onOpenCart={() => setIsOpen(true)}
      />
      <CartDrawer
        isOpen={isOpen}
        cart={cart}
        total={cartTotal}
        onClose={() => setIsOpen(false)}
        onUpdateQuantity={updateQuantity}
        onCheckout={handleCheckout}
      />
      {isPaymentOpen && (
        <PaymentModal
          cart={cart}
          subtotal={cartTotal}
          onClose={() => setIsPaymentOpen(false)}
          onPaid={clearCart}
        />
      )}
    </>
  );
}
