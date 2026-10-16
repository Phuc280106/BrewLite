'use client';

import { ProductSizeOption, ProductToppingOption } from '../../types';
import { ProductSize } from './product-options';
import { useOptionsStore } from './useOptionsStore';

interface ProductOptionsProps {
  sizes?: ProductSizeOption[];
  toppings?: ProductToppingOption[];
  selectedSize: ProductSize;
  onSelectSize: (size: ProductSize) => void;
  selectedToppings: string[];
  onToggleTopping: (toppingId: string) => void;
  quantity: number;
  stock: number;
  onDecreaseQuantity: () => void;
  onIncreaseQuantity: (stock: number) => void;
  formatMoney: (value: number) => string;
}

export default function ProductOptions({
  sizes,
  toppings,
  selectedSize,
  onSelectSize,
  selectedToppings,
  onToggleTopping,
  quantity,
  stock,
  onDecreaseQuantity,
  onIncreaseQuantity,
  formatMoney,
}: ProductOptionsProps) {
  const storeSizes = useOptionsStore((state) => state.sizes);
  const storeToppings = useOptionsStore((state) => state.toppings);

  const activeSizes = sizes && sizes.length > 0 ? sizes : storeSizes;
  const activeToppings = toppings && toppings.length > 0 ? toppings : storeToppings;

  return (
    <>
      <div>
        <div className="flex justify-between items-center mb-3">
          <label className="text-sm font-bold uppercase tracking-wider text-stone-700">
            1. Chọn kích cỡ (Size)
          </label>
          <span className="text-xs text-stone-400">Bắt buộc</span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {activeSizes.map((size) => {
            const isSelected = selectedSize === size.id;
            return (
              <button
                key={size.id}
                type="button"
                onClick={() => onSelectSize(size.id)}
                className={`py-3 px-2 rounded-2xl border text-center transition-all ${
                  isSelected
                    ? 'border-amber-500 bg-amber-50 text-amber-800 font-bold shadow-sm ring-2 ring-amber-500/20'
                    : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                }`}
              >
                <div className="text-sm font-semibold">{size.label}</div>
                <div className="text-[11px] text-stone-400 mt-0.5">
                  {size.extraPrice > 0
                    ? `+${formatMoney(size.extraPrice)}`
                    : 'Gốc'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-3">
          <label className="text-sm font-bold uppercase tracking-wider text-stone-700">
            2. Thêm Topping
          </label>
          <span className="text-xs text-stone-400">Tùy chọn</span>
        </div>
        <div className="space-y-2">
          {activeToppings.map((topping) => {
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
                    onChange={() => onToggleTopping(topping.id)}
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

      <div className="flex items-center justify-between pt-2">
        <span className="text-sm font-bold uppercase tracking-wider text-stone-700">
          Số lượng
        </span>
        <div className="flex items-center gap-3 bg-white border border-stone-200 rounded-2xl px-3 py-1.5 shadow-sm">
          <button
            type="button"
            onClick={onDecreaseQuantity}
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
            onClick={() => onIncreaseQuantity(stock)}
            className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center font-bold text-lg disabled:opacity-40"
            disabled={quantity >= stock}
          >
            +
          </button>
        </div>
      </div>
    </>
  );
}
