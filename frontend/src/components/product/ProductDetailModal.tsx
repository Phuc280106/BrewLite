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
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Gọi API GET /products/:id để lấy dữ liệu tồn kho và giá mới nhất từ CSDL
  useEffect(() => {
    let isMounted = true;
    async function fetchDetail() {
      try {
        setIsRefreshing(true);
        const res = await api.get<ProductResponse>(`/products/${initialProduct.id}`);
        if (res.data && isMounted) {
          setProduct((prev) => ({
            ...prev,
            name: res.data.name || prev.name,
            price: res.data.price ?? prev.price,
            stock: res.data.stock ?? prev.stock,
            note: res.data.description || prev.note,
            image: res.data.imageUrl || prev.image,
            category: res.data.category || prev.category,
          }));
        }
      } catch (err) {
        console.warn(`Lỗi lấy chi tiết sản phẩm ${initialProduct.id}:`, err);
      } finally {
        if (isMounted) setIsRefreshing(false);
      }
    }

    void fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [initialProduct.id]);

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
  } = useProductOptions(product, onAddToCart, onClose);

  const formatMoney = (value: number) => `${value.toLocaleString('vi-VN')} ₫`;

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
            className="w-full h-full object-cover"
          />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/80 backdrop-blur-md text-stone-700 flex items-center justify-center hover:bg-white transition-colors shadow-md cursor-pointer"
            aria-label="Đóng"
          >
            ✕
          </button>
          {product.tag && (
            <span className="absolute bottom-4 left-4 bg-amber-500 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
              {product.tag}
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
            <div className="flex items-center gap-2 mt-1.5">
              <span
                className={`text-[11px] font-medium ${
                  product.stock > 0 ? 'text-emerald-700' : 'text-rose-600'
                }`}
              >
                ● {product.stock > 0 ? `Còn lại: ${product.stock} ly` : 'Tạm thời hết hàng'}
              </span>
              {isRefreshing && (
                <span className="text-[10px] text-stone-400 italic">
                  (đang cập nhật...)
                </span>
              )}
            </div>
          </div>

          <hr className="border-stone-200" />

          <ProductOptions
            sizes={sizes}
            toppings={toppings}
            selectedSize={selectedSize}
            onSelectSize={setSelectedSize}
            selectedToppings={selectedToppings}
            onToggleTopping={toggleTopping}
            quantity={quantity}
            stock={product.stock}
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
            disabled={product.stock <= 0}
            className="flex-1 py-3.5 px-6 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-white font-bold text-sm shadow-lg shadow-amber-500/25 transition-all text-center disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {product.stock <= 0
              ? 'Hết hàng'
              : `Thêm vào giỏ hàng • ${formatMoney(totalPrice)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
