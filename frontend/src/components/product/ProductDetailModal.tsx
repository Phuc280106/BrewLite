'use client';

import React, { useEffect, useState } from 'react';
import { ProductItem, CartItemOptions } from '../../types';
import { api, Product as ProductResponse } from '../../lib/api';
import useProductOptions from './useProductOptions';
import ProductOptions from './ProductOptions';

interface ProductDetailModalProps {
  product: ProductItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (options: CartItemOptions) => void;
}

export default function ProductDetailModal({
  product,
  isOpen,
  onClose,
  onAddToCart,
}: ProductDetailModalProps) {
  if (!isOpen || !product) return null;

  return (
    <ProductDetailDialog
      key={product.id}
      initialProduct={product}
      onClose={onClose}
      onAddToCart={onAddToCart}
    />
  );
}

interface ProductDetailDialogProps {
  initialProduct: ProductItem;
  onClose: () => void;
  onAddToCart: (options: CartItemOptions) => void;
}

function ProductDetailDialog({
  initialProduct,
  onClose,
  onAddToCart,
}: ProductDetailDialogProps) {
  const [product, setProduct] = useState<ProductItem>(initialProduct);
  const [availabilityBySize, setAvailabilityBySize] = useState<Record<string, number> | null>(null);
  const [maxAvailability, setMaxAvailability] = useState<number | null>(null);

  // Gọi API GET /products/:id và GET /orders/availability/:id để kiểm tra tồn kho mới nhất
  useEffect(() => {
    let isMounted = true;
    async function fetchDetail() {
      try {
        const [prodRes, availRes] = await Promise.allSettled([
          api.get<ProductResponse>(`/products/${initialProduct.id}`),
          api.get<{ productId: number; maxCups: number; availability: number; bySize?: Record<string, number> }>(
            `/orders/availability/${initialProduct.id}`
          ),
        ]);

        if (prodRes.status === 'fulfilled' && prodRes.value.data && isMounted) {
          const data = prodRes.value.data;
          const freshStock = data.stock ?? prevStock(data.stock, initialProduct.stock);
          setProduct((prev) => ({
            ...prev,
            name: data.name || prev.name,
            price: data.price ?? prev.price,
            stock: freshStock,
            note: data.description || prev.note,
            image: data.imageUrl || prev.image,
            category: data.category || prev.category,
            tag: freshStock <= 0 ? 'Out of Stock' : prev.tag,
          }));
        }

        if (availRes.status === 'fulfilled' && availRes.value.data && isMounted) {
          const avail = availRes.value.data;
          setMaxAvailability(avail.availability ?? avail.maxCups ?? null);
          if (avail.bySize) {
            setAvailabilityBySize(avail.bySize);
          }
        }
      } catch (err) {
        console.warn(`Lỗi lấy chi tiết sản phẩm ${initialProduct.id}:`, err);
      }
    }

    void fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [initialProduct.id, initialProduct.stock]);

  function prevStock(val?: number, fallback?: number) {
    return val !== undefined ? val : (fallback ?? 0);
  }

  const [provisionalSize, setProvisionalSize] = useState<string>('M');
  const currentSizeAvailability =
    availabilityBySize && provisionalSize in availabilityBySize
      ? availabilityBySize[provisionalSize]
      : (maxAvailability ?? product.stock ?? 0);

  const {
    sizes,
    toppings,
    selectedSize,
    setSelectedSize,
    selectedToppings,
    toggleTopping,
    quantity,
    decreaseQuantity,
    increaseQuantity,
    totalPrice,
    confirm,
  } = useProductOptions(product, onAddToCart, onClose, currentSizeAvailability);

  // Đồng bộ provisionalSize với selectedSize
  useEffect(() => {
    setProvisionalSize(selectedSize);
  }, [selectedSize]);

  const formatMoney = (value: number) => `${value.toLocaleString('vi-VN')} ₫`;

  const isOutOfStock = currentSizeAvailability <= 0 || (product.stock ?? 0) <= 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-[#fafaf9] rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-stone-200 animate-slideUp"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative w-full h-56 bg-stone-100 flex-shrink-0 overflow-hidden">
          <img
            src={product.image}
            alt={product.name}
            className={`w-full h-full object-cover ${isOutOfStock ? 'opacity-80 grayscale-[20%]' : ''}`}
          />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/80 backdrop-blur-md text-stone-700 flex items-center justify-center hover:bg-white transition-colors shadow-md cursor-pointer"
            aria-label="Đóng"
          >
            ✕
          </button>
          {product.tag && (
            <span
              className={`absolute bottom-4 left-4 text-xs font-semibold px-3 py-1 rounded-full shadow-sm ${
                isOutOfStock
                  ? 'bg-stone-200 text-stone-600'
                  : 'bg-amber-500 text-white'
              }`}
            >
              {isOutOfStock ? 'Out of Stock' : product.tag}
            </span>
          )}
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-stone-800">
          <div>
            <div className="flex justify-between items-baseline">
              <h2 className="text-2xl font-bold tracking-tight text-stone-900">
                {product.name}
              </h2>
              <span className="text-xl font-extrabold text-amber-600">
                {formatMoney(product.price)}
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
              {product.note}
            </p>
          </div>

          <hr className="border-stone-200" />

          <ProductOptions
            sizes={sizes}
            toppings={toppings}
            selectedSize={selectedSize}
            onSelectSize={(size) => {
              setProvisionalSize(size);
              setSelectedSize(size);
            }}
            selectedToppings={selectedToppings}
            onToggleTopping={toggleTopping}
            quantity={quantity}
            stock={currentSizeAvailability}
            onDecreaseQuantity={decreaseQuantity}
            onIncreaseQuantity={increaseQuantity}
            formatMoney={formatMoney}
          />
        </div>

        <div className="p-4 bg-white border-t border-stone-200 flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] text-stone-400">Tạm tính:</div>
            <div className="text-xl font-extrabold text-amber-600">
              {formatMoney(totalPrice)}
            </div>
          </div>

          <button
            type="button"
            onClick={confirm}
            disabled={currentSizeAvailability <= 0}
            className="flex-1 py-3.5 px-6 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-white font-bold text-sm shadow-lg shadow-amber-500/25 transition-all text-center disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {currentSizeAvailability <= 0
              ? 'Hết hàng'
              : `Thêm vào giỏ hàng • ${formatMoney(totalPrice)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
