'use client';

import React, { useState, useEffect } from 'react';

// Định nghĩa kiểu dữ liệu cho Tùy chọn (Size & Topping)
export interface SelectedOptions {
  size: 'S' | 'M' | 'L';
  toppings: string[];
  quantity: number;
  finalPrice: number;
}

interface ProductDetailModalProps {
  product: {
    id: number;
    name: string;
    note: string;
    price: number;
    stock: number;
    category: string;
    tag?: string;
    image: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (options: {
    product: any;
    size: 'S' | 'M' | 'L';
    toppings: string[];
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }) => void;
}

// Danh sách Size và phụ thu
const SIZES = [
  { id: 'S', label: 'Size S', extraPrice: 0, desc: 'Tiêu chuẩn' },
  { id: 'M', label: 'Size M', extraPrice: 5000, desc: 'Vừa (+5.000₫)' },
  { id: 'L', label: 'Size L', extraPrice: 10000, desc: 'Lớn (+10.000₫)' },
] as const;

// Danh sách Topping và giá
const TOPPINGS = [
  { id: 'pearl', name: 'Trân châu đen', price: 5000 },
  { id: 'cheese', name: 'Kem Macchiato', price: 10000 },
  { id: 'peach_jelly', name: 'Thạch đào giòn', price: 8000 },
];

export default function ProductDetailModal({
  product,
  isOpen,
  onClose,
  onAddToCart,
}: ProductDetailModalProps) {
  const [selectedSize, setSelectedSize] = useState<'S' | 'M' | 'L'>('M');
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const [quantity, setQuantity] = useState<number>(1);

  // Reset lại trạng thái khi mở món mới
  useEffect(() => {
    if (product) {
      setSelectedSize('M');
      setSelectedToppings([]);
      setQuantity(1);
    }
  }, [product]);

  if (!isOpen || !product) return null;

  // 1. Logic tính giá động thời gian thực (Giá gốc + Size + Topping)
  const sizeExtra = SIZES.find((s) => s.id === selectedSize)?.extraPrice || 0;
  const toppingExtra = selectedToppings.reduce((sum, topId) => {
    const top = TOPPINGS.find((t) => t.id === topId);
    return sum + (top ? top.price : 0);
  }, 0);

  const unitPrice = product.price + sizeExtra + toppingExtra; // Đơn giá 1 ly
  const totalPrice = unitPrice * quantity; // Tổng giá theo số lượng

  const formatMoney = (val: number) => `${val.toLocaleString('vi-VN')} ₫`;

  // Toggle Topping
  const handleToggleTopping = (toppingId: string) => {
    setSelectedToppings((prev) =>
      prev.includes(toppingId)
        ? prev.filter((id) => id !== toppingId)
        : [...prev, toppingId]
    );
  };

  // Xác nhận thêm vào giỏ
  const handleConfirm = () => {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-[#fafaf9] rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-stone-200 animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header với ảnh sản phẩm */}
        <div className="relative w-full h-56 bg-stone-100 flex-shrink-0 overflow-hidden">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/80 backdrop-blur-md text-stone-700 flex items-center justify-center hover:bg-white transition-colors shadow-md"
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

        {/* Nội dung chi tiết cuộn được */}
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
            <p className="text-[11px] text-emerald-700 font-medium mt-1">
              ● Còn lại: {product.stock} ly
            </p>
          </div>

          <hr className="border-stone-200" />

          {/* 1. Chọn Size (S / M / L) */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-bold uppercase tracking-wider text-stone-700">
                1. Chọn kích cỡ (Size)
              </label>
              <span className="text-xs text-stone-400">Bắt buộc</span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {SIZES.map((size) => {
                const isSelected = selectedSize === size.id;
                return (
                  <button
                    key={size.id}
                    type="button"
                    onClick={() => setSelectedSize(size.id)}
                    className={`py-3 px-2 rounded-2xl border text-center transition-all ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50 text-amber-800 font-bold shadow-sm ring-2 ring-amber-500/20'
                        : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                    }`}
                  >
                    <div className="text-sm font-semibold">{size.label}</div>
                    <div className="text-[11px] text-stone-400 mt-0.5">
                      {size.extraPrice > 0 ? `+${formatMoney(size.extraPrice)}` : 'Gốc'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Chọn Topping */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-bold uppercase tracking-wider text-stone-700">
                2. Thêm Topping
              </label>
              <span className="text-xs text-stone-400">Tùy chọn</span>
            </div>
            <div className="space-y-2">
              {TOPPINGS.map((topping) => {
                const isChecked = selectedToppings.includes(topping.id);
                return (
                  <label
                    key={topping.id}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      isChecked
                        ? 'border-amber-500 bg-amber-50/60 text-stone-900 shadow-sm'
                        : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleTopping(topping.id)}
                        className="w-4 h-4 text-amber-600 rounded border-stone-300 focus:ring-amber-500 cursor-pointer"
                      />
                      <span className="text-sm font-medium">{topping.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-amber-700">
                      +{formatMoney(topping.price)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 3. Chọn số lượng */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm font-bold uppercase tracking-wider text-stone-700">
              Số lượng
            </span>
            <div className="flex items-center gap-3 bg-white border border-stone-200 rounded-2xl px-3 py-1.5 shadow-sm">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center font-bold text-lg disabled:opacity-40"
                disabled={quantity <= 1}
              >
                −
              </button>
              <span className="w-8 text-center font-bold text-base text-stone-800">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center font-bold text-lg disabled:opacity-40"
                disabled={quantity >= product.stock}
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Footer: Tổng tiền & Nút Thêm vào giỏ */}
        <div className="p-4 bg-white border-t border-stone-200 flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] text-stone-400">Tạm tính:</div>
            <div className="text-xl font-extrabold text-amber-600">
              {formatMoney(totalPrice)}
            </div>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-3.5 px-6 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-white font-bold text-sm shadow-lg shadow-amber-500/25 transition-all text-center"
          >
            Thêm vào giỏ hàng • {formatMoney(totalPrice)}
          </button>
        </div>
      </div>
    </div>
  );
}
