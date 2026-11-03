'use client';

import { create } from 'zustand';
import { CartItem, CartItemOptions } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';

interface CartStore {
  cart: CartItem[];
  ordered: boolean;
  toastMessage: string | null;
  addToCart: (options: CartItemOptions) => void;
  updateQuantity: (cartItemId: string, change: number) => void;
  completeCheckout: () => void;
  clearCart: () => void;
  loadCartForUser: (userId?: number | null) => void;
}

let toastTimeout: ReturnType<typeof setTimeout> | null = null;

function getCartStorageKey(userId?: number | null): string {
  return userId ? `brewlite-cart-user-${userId}` : 'brewlite-cart-guest';
}

function loadCartFromStorage(userId?: number | null): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = getCartStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : parsed?.cart || [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function saveCartToStorage(cart: CartItem[], userId?: number | null) {
  if (typeof window === 'undefined') return;
  try {
    const key = getCartStorageKey(userId);
    localStorage.setItem(key, JSON.stringify({ cart }));
  } catch (err) {
    console.warn('Failed to save cart to localStorage', err);
  }
}

export const useCartStore = create<CartStore>()((set) => ({
  cart: [],
  ordered: false,
  toastMessage: null,

  addToCart: (options) => {
    const toppings = [...options.toppings];
    const cartItemId = `${options.product.id}-${options.size}-${[...toppings]
      .sort()
      .join('-')}`;
    const currentUserId = useAuthStore.getState().user?.id ?? null;

    set((state) => {
      const existingIndex = state.cart.findIndex(
        (item) => item.cartItemId === cartItemId
      );

      let nextCart: CartItem[];
      if (existingIndex > -1) {
        nextCart = [...state.cart];
        const maxStock =
          nextCart[existingIndex].maxStock ?? options.product.stock ?? 0;
        const newQty = Math.min(
          maxStock > 0 ? maxStock : 99,
          nextCart[existingIndex].quantity + options.quantity
        );
        nextCart[existingIndex] = {
          ...nextCart[existingIndex],
          quantity: newQty,
          maxStock:
            maxStock > 0 ? maxStock : nextCart[existingIndex].maxStock ?? 99,
        };
      } else {
        const maxStock = options.product.stock ?? 0;
        nextCart = [
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
            maxStock: maxStock > 0 ? maxStock : 99,
          },
        ];
      }

      saveCartToStorage(nextCart, currentUserId);
      return { cart: nextCart, ordered: false };
    });

    set({
      toastMessage: `Đã thêm ${options.quantity}x ${options.product.name} (Size ${options.size}) vào giỏ!`,
    });
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => set({ toastMessage: null }), 3000);
  },

  updateQuantity: (cartItemId, change) => {
    let reachedLimit = false;
    let limitVal = 0;
    const currentUserId = useAuthStore.getState().user?.id ?? null;

    set((state) => {
      const nextCart = state.cart
        .map((item) => {
          if (item.cartItemId !== cartItemId) return item;
          const maxStock = item.maxStock ?? 99;
          if (change > 0 && item.quantity >= maxStock) {
            reachedLimit = true;
            limitVal = maxStock;
            return item;
          }
          const nextQuantity = item.quantity + change;
          return nextQuantity > 0
            ? { ...item, quantity: nextQuantity }
            : null;
        })
        .filter((item): item is CartItem => item !== null);

      saveCartToStorage(nextCart, currentUserId);
      return { cart: nextCart };
    });

    if (reachedLimit) {
      set({
        toastMessage: 'Đã đạt số lượng tối đa có thể đặt!',
      });
      if (toastTimeout) clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => set({ toastMessage: null }), 3000);
    }
  },

  completeCheckout: () => {
    const currentUserId = useAuthStore.getState().user?.id ?? null;
    saveCartToStorage([], currentUserId);
    set({ ordered: true, cart: [] });
  },

  clearCart: () => {
    const currentUserId = useAuthStore.getState().user?.id ?? null;
    saveCartToStorage([], currentUserId);
    set({ cart: [] });
  },

  loadCartForUser: (userId?: number | null) => {
    const loadedCart = loadCartFromStorage(userId);
    set({ cart: loadedCart, ordered: false });
  },
}));

// Tương thích ngược với lời gọi `useCartStore.persist.rehydrate()`
(useCartStore as any).persist = {
  rehydrate: () => {
    const currentUserId = useAuthStore.getState().user?.id ?? null;
    useCartStore.getState().loadCartForUser(currentUserId);
  },
};

// Tự động đồng bộ giỏ hàng riêng biệt theo từng tài khoản khi đăng nhập / đăng xuất
if (typeof window !== 'undefined') {
  try {
    // Dọn dẹp key cũ không phân biệt tài khoản để tránh rò rỉ dữ liệu
    localStorage.removeItem('brewlite-cart');
  } catch {}

  let previousUserId = useAuthStore.getState().user?.id ?? null;

  useAuthStore.subscribe((state) => {
    const newUserId = state.user?.id ?? null;
    if (newUserId !== previousUserId) {
      previousUserId = newUserId;
      useCartStore.getState().loadCartForUser(newUserId);
    }
  });
}
