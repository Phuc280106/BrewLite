import { ProductSizeOption, ProductToppingOption } from '../../types';

export const DEFAULT_PRODUCT_SIZES: ProductSizeOption[] = [
  { id: 'S', label: 'Size S', extraPrice: 0 },
  { id: 'M', label: 'Size M', extraPrice: 5000 },
  { id: 'L', label: 'Size L', extraPrice: 10000 },
];

export const DEFAULT_PRODUCT_TOPPINGS: ProductToppingOption[] = [
  { id: 'pearl', name: 'Trân châu đen', price: 5000 },
  { id: 'cheese', name: 'Kem Macchiato', price: 10000 },
  { id: 'peach_jelly', name: 'Thạch đào giòn', price: 8000 },
];

export const PRODUCT_SIZES = DEFAULT_PRODUCT_SIZES;
export const PRODUCT_TOPPINGS = DEFAULT_PRODUCT_TOPPINGS;

export type ProductSize = 'S' | 'M' | 'L' | string;
