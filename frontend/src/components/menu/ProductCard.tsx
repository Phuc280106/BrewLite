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
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=650&q=85';
          }}
        />
        <span
          className={`product-tag ${
            product.tag === 'Best Seller' || product.tag === 'Popular'
              ? 'bestseller'
              : ''
          }`}
        >
          {product.tag === 'In Stock' && <i />}
          {product.tag}
        </span>
        {quantityInCart > 0 && (
          <span className="quantity-badge">{quantityInCart} in bag</span>
        )}
      </div>

      <div className="product-details">
        <h4>{product.name}</h4>
        <p className="product-note">{product.note}</p>
        <p className="stock">
          <span />
          {Math.max(0, product.stock - quantityInCart)}{' '}
          {product.category === 'Pastries' ? 'pieces' : 'cups'} left
        </p>

        <div className="product-bottom">
          <strong>{formatMoney(product.price)}</strong>
          <button
            type="button"
            className="add-button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(product);
            }}
            disabled={quantityInCart >= product.stock}
            title="Chọn size và topping"
          >
            <Icon name="plus" size={19} />
          </button>
        </div>
      </div>
    </article>
  );
}
