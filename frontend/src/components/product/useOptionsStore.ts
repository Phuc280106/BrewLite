import { create } from 'zustand';
import { api } from '../../lib/api';
import {
  ProductOptionsResponse,
  ProductSizeOption,
  ProductToppingOption,
} from '../../types';
import {
  DEFAULT_PRODUCT_SIZES,
  DEFAULT_PRODUCT_TOPPINGS,
} from './product-options';

interface OptionsState {
  sizes: ProductSizeOption[];
  toppings: ProductToppingOption[];
  isLoading: boolean;
  hasLoaded: boolean;
  fetchOptions: (force?: boolean) => Promise<void>;
}

export const useOptionsStore = create<OptionsState>((set, get) => ({
  sizes: DEFAULT_PRODUCT_SIZES,
  toppings: DEFAULT_PRODUCT_TOPPINGS,
  isLoading: false,
  hasLoaded: false,
  fetchOptions: async (force = false) => {
    if (get().isLoading || (!force && get().hasLoaded)) return;
    set({ isLoading: true });
    try {
      const response = await api.get<ProductOptionsResponse>('/options');
      if (response.data?.sizes && response.data?.toppings) {
        set({
          sizes: response.data.sizes,
          toppings: response.data.toppings,
          hasLoaded: true,
        });
      }
    } catch (error) {
      console.warn(
        'Could not fetch options from server, using fallback defaults:',
        error
      );
    } finally {
      set({ isLoading: false });
    }
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('brewlite:refresh-products', () => {
    void useOptionsStore.getState().fetchOptions(true);
  });
}
