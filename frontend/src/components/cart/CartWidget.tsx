'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import CartBottomBar from './CartBottomBar';
import CartDrawer from './CartDrawer';
import { useCartStore } from './useCartStore';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/api';
import { CheckoutError, CreateOrderResponse } from '@/types';

export default function CartWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderCode, setOrderCode] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<CheckoutError | null>(null);
  const user = useAuthStore((state) => state.user);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);
  const cart = useCartStore((state) => state.cart);
  const ordered = useCartStore((state) => state.ordered);
  const toastMessage = useCartStore((state) => state.toastMessage);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const completeCheckout = useCartStore((state) => state.completeCheckout);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  useEffect(() => {
    void useCartStore.persist.rehydrate();
  }, []);

  const handleCheckout = async () => {
    if (cart.length === 0 || isSubmitting) return;

    if (!user) {
      setIsOpen(false);
      openAuthModal('login', 'Vui lòng đăng nhập để tiến hành đặt hàng');
      return;
    }

    setIsSubmitting(true);
    setCheckoutError(null);
    try {
      const response = await api.post<CreateOrderResponse>('/orders', {
        items: cart.map(({ productId, size, toppings, quantity }) => ({
          productId,
          size,
          toppings,
          quantity,
        })),
      });

      setOrderCode(response.data.orderCode);
      completeCheckout();
    } catch (error) {
      if (axios.isAxiosError<CheckoutError>(error)) {
        setCheckoutError(
          error.response?.data ?? {
            message: 'Could not place the order. Please try again.',
          }
        );
      } else {
        setCheckoutError({
          message: 'Could not place the order. Please try again.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
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
        checkoutError={checkoutError}
        onClose={() => setIsOpen(false)}
        onUpdateQuantity={updateQuantity}
        onCheckout={handleCheckout}
      />
    </>
  );
}
