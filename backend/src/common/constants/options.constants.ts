export const PRODUCT_SIZES = [
  { id: 'S', label: 'Size S', extraPrice: 0 },
  { id: 'M', label: 'Size M', extraPrice: 5000 },
  { id: 'L', label: 'Size L', extraPrice: 10000 },
] as const;

export type ProductSizeId = (typeof PRODUCT_SIZES)[number]['id'];

export const SIZE_EXTRA_PRICE: Record<ProductSizeId, number> = {
  S: 0,
  M: 5000,
  L: 10000,
};

export const ALLOWED_SIZE_IDS = PRODUCT_SIZES.map((size) => size.id) as [
  ProductSizeId,
  ...ProductSizeId[],
];

export const PRODUCT_TOPPINGS = [
  { id: 'pearl', name: 'Trân châu đen', price: 5000 },
  { id: 'cheese', name: 'Kem Macchiato', price: 10000 },
  { id: 'peach_jelly', name: 'Thạch đào giòn', price: 8000 },
] as const;

export type ToppingId = (typeof PRODUCT_TOPPINGS)[number]['id'];

export const TOPPING_PRICE: Record<string, number> = {
  pearl: 5000,
  cheese: 10000,
  peach_jelly: 8000,
};

export const ALLOWED_TOPPING_IDS = PRODUCT_TOPPINGS.map(
  (topping) => topping.id
) as [string, ...string[]];
