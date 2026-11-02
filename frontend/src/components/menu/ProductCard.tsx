'use client';

import React from 'react';
import { ProductItem } from '../../types';
import Icon from '../common/Icon';

interface ProductCardProps {
  product: ProductItem;
  quantityInCart: number;
  onSelect: (product: ProductItem) => void;
}

export default function ProductCard({
  product,
  quantityInCart,
  onSelect,
}: ProductCardProps) {
  const formatMoney = (val: number) => `${val.toLocaleString('vi-VN')} ₫`;
  const availableStock = product.stock ?? 0;
  const isOutOfStock = availableStock <= 0;
  const remainingStock = Math.max(0, availableStock - quantityInCart);
  const displayTag = isOutOfStock ? 'Out of Stock' : (product.tag || 'In Stock');

  return (
    <article
      className="product-card cursor-pointer group"
      onClick={() => onSelect(product)}
    >
      <div className="product-image">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className={isOutOfStock ? 'opacity-75 grayscale-[25%]' : ''}
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=650&q=85';
          }}
        />
        <span
          className={`product-tag ${
            isOutOfStock
              ? 'out-of-stock !bg-stone-100 !text-stone-500 border border-stone-200'
              : displayTag === 'Best Seller' || displayTag === 'Popular'
              ? 'bestseller'
              : ''
          }`}
        >
          {displayTag === 'In Stock' && <i />}
          {isOutOfStock && <i className="!bg-rose-500" />}
          {displayTag}
        </span>
        {quantityInCart > 0 && (
          <span className="quantity-badge">{quantityInCart} in bag</span>
        )}
      </div>

      <div className="product-details">
        <h4>{product.name}</h4>
        <p className="product-note">{product.note}</p>
        {isOutOfStock && (
          <p className="stock text-rose-500 font-medium">
            <span className="!bg-rose-500" />
            Hết nguyên liệu pha chế
          </p>
        )}

        <div className="product-bottom">
          <strong>{formatMoney(product.price)}</strong>
          <button
            type="button"
            className="add-button disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(product);
            }}
            disabled={remainingStock <= 0 || isOutOfStock}
            title={
              isOutOfStock
                ? 'Đã hết nguyên liệu pha chế'
                : remainingStock <= 0
                ? 'Đã chọn số lượng tối đa có thể pha chế'
                : 'Chọn size và topping'
            }
          >
            <Icon name="plus" size={19} />
          </button>
        </div>
      </div>
    </article>
  );
}
