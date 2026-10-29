'use client';

import { useEffect, useState } from 'react';
import CartBottomBar from './CartBottomBar';
import CartDrawer from './CartDrawer';
import PaymentModal from './PaymentModal';
import { useCartStore } from './useCartStore';
import { useAuthStore } from '@/store/useAuthStore';
import { CheckoutError } from '@/types';

export default function CartWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderCode, setOrderCode] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<CheckoutError | null>(null);

  const user = useAuthStore((state) => state.user);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);
  const cart = useCartStore((state) => state.cart);
  const ordered = useCartStore((state) => state.ordered);
  const toastMessage = useCartStore((state) => state.toastMessage);
  const updateQuantity = useCartStore((state) => state.updateQuantity);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  useEffect(() => {
    void useCartStore.persist.rehydrate();
  }, []);

  const handleCheckoutClick = () => {
    if (cart.length === 0) return;

    if (!user) {
      setIsOpen(false);
      openAuthModal('login', 'Vui lòng đăng nhập để tiến hành thanh toán đơn hàng');
      return;
    }

    setCheckoutError(null);
    // Đóng CartDrawer và mở PaymentModal
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
        ordered={ordered}
        isSubmitting={isSubmitting}
        orderCode={orderCode}
        orderStatus={orderStatus}
        checkoutError={checkoutError}
        onClose={() => setIsOpen(false)}
        onUpdateQuantity={updateQuantity}
        onCheckout={handleCheckoutClick}
      />

      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        cart={cart}
        subtotal={cartTotal}
      />
    </>
  );
}
