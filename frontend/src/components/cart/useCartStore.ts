'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { CartItem, CartItemOptions } from '../../types';

interface CartStore {
  cart: CartItem[];
  toastMessage: string | null;
  addToCart: (options: CartItemOptions) => void;
  updateQuantity: (cartItemId: string, change: number) => void;
  clearCart: () => void;
}

interface PersistedCartState {
  cart: CartItem[];
}

let toastTimeout: ReturnType<typeof setTimeout> | null = null;

export const useCartStore = create<CartStore>()(
  persist<CartStore, [], [], PersistedCartState>(
    (set) => ({
      cart: [],
      toastMessage: null,
      addToCart: (options) => {
        const toppings = [...options.toppings];
        const cartItemId = `${options.product.id}-${options.size}-${[...toppings]
          .sort()
          .join('-')}`;

        set((state) => {
          const existingIndex = state.cart.findIndex(
            (item) => item.cartItemId === cartItemId
          );

          if (existingIndex > -1) {
            const cart = [...state.cart];
            cart[existingIndex] = {
              ...cart[existingIndex],
              quantity: cart[existingIndex].quantity + options.quantity,
            };
            return { cart };
          }

          return {
            cart: [
              ...state.cart,
              {
                cartItemId,
                productId: options.product.id,
                name: options.product.name,
                image: options.product.image,
                size: options.size,
                toppings,
                unitPrice: options.unitPrice,
                quantity: options.quantity,
              },
            ],
          };
        });

        set({
          toastMessage: `Đã thêm ${options.quantity}x ${options.product.name} (Size ${options.size}) vào giỏ!`,
        });
        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => set({ toastMessage: null }), 3000);
      },
      updateQuantity: (cartItemId, change) =>
        set((state) => ({
          cart: state.cart
            .map((item) => {
              if (item.cartItemId !== cartItemId) return item;
              const nextQuantity = item.quantity + change;
              return nextQuantity > 0
                ? { ...item, quantity: nextQuantity }
                : null;
            })
            .filter((item): item is CartItem => item !== null),
        })),
      clearCart: () => set({ cart: [] }),
    }),
    {
      name: 'brewlite-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ cart: state.cart }),
      skipHydration: true,
    }
  )
);
