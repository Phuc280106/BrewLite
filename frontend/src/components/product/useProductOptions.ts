'use client';

import { useState } from 'react';
import { CartItemOptions, ProductItem } from '../../types';
import { PRODUCT_SIZES, PRODUCT_TOPPINGS, ProductSize } from './product-options';

export default function useProductOptions(
  product: ProductItem | null,
  onAddToCart: (options: CartItemOptions) => void,
  onClose: () => void
) {
  const [selectedSize, setSelectedSize] = useState<ProductSize>('M');
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);

  const sizeExtra =
    PRODUCT_SIZES.find((size) => size.id === selectedSize)?.extraPrice ?? 0;
  const toppingsExtra = selectedToppings.reduce((total, toppingId) => {
    const topping = PRODUCT_TOPPINGS.find((item) => item.id === toppingId);
    return total + (topping?.price ?? 0);
  }, 0);
  const unitPrice = (product?.price ?? 0) + sizeExtra + toppingsExtra;
  const totalPrice = unitPrice * quantity;

  const toggleTopping = (toppingId: string) => {
    setSelectedToppings((previous) =>
      previous.includes(toppingId)
        ? previous.filter((id) => id !== toppingId)
        : [...previous, toppingId]
    );
  };

  const confirm = () => {
    if (!product) return;
    onAddToCart({
      product,
      size: selectedSize,
      toppings: selectedToppings,
      quantity,
      unitPrice,
      totalPrice,
    });
    onClose();
  };

  return {
    selectedSize,
    setSelectedSize,
    selectedToppings,
    toggleTopping,
    quantity,
    decreaseQuantity: () => setQuantity((current) => Math.max(1, current - 1)),
    increaseQuantity: (stock: number) =>
      setQuantity((current) => Math.min(stock, current + 1)),
    unitPrice,
    totalPrice,
    confirm,
  };
}
