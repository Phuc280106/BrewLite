export const PRODUCT_SIZES = [
  { id: 'S', label: 'Size S', extraPrice: 0 },
  { id: 'M', label: 'Size M', extraPrice: 5000 },
  { id: 'L', label: 'Size L', extraPrice: 10000 },
] as const;

export const PRODUCT_TOPPINGS = [
  { id: 'pearl', name: 'Trân châu đen', price: 5000 },
  { id: 'cheese', name: 'Kem Macchiato', price: 10000 },
  { id: 'peach_jelly', name: 'Thạch đào giòn', price: 8000 },
];

export type ProductSize = (typeof PRODUCT_SIZES)[number]['id'];
