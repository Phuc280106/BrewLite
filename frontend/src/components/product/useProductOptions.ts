'use client';

import { useEffect, useState } from 'react';
import { CartItemOptions, ProductItem } from '../../types';
import { ProductSize } from './product-options';
import { useOptionsStore } from './useOptionsStore';

export default function useProductOptions(
  product: ProductItem | null,
  onAddToCart: (options: CartItemOptions) => void,
  onClose: () => void
) {
  const sizes = useOptionsStore((state) => state.sizes);
  const toppings = useOptionsStore((state) => state.toppings);
  const fetchOptions = useOptionsStore((state) => state.fetchOptions);

  useEffect(() => {
    void fetchOptions();
  }, [fetchOptions]);

  const [selectedSize, setSelectedSize] = useState<ProductSize>('M');
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);

  const sizeExtra =
    sizes.find((size) => size.id === selectedSize)?.extraPrice ?? 0;
  const toppingsExtra = selectedToppings.reduce((total, toppingId) => {
    const topping = toppings.find((item) => item.id === toppingId);
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
      size: selectedSize as 'S' | 'M' | 'L',
      toppings: selectedToppings,
      quantity,
      unitPrice,
      totalPrice,
    });
    onClose();
  };

  return {
    sizes,
    toppings,
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
