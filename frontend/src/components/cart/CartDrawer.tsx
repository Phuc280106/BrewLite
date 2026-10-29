'use client';

import React from 'react';
import { CartItem } from '../../types';
import Icon from '../common/Icon';

interface CartDrawerProps {
  isOpen: boolean;
  cart: CartItem[];
  total: number;
  onClose: () => void;
  onUpdateQuantity: (cartItemId: string, change: number) => void;
  onCheckout: () => void;
}

export default function CartDrawer({
  isOpen,
  cart,
  total,
  onClose,
  onUpdateQuantity,
  onCheckout,
}: CartDrawerProps) {
  if (!isOpen) return null;

  const formatMoney = (val: number) => `${val.toLocaleString('vi-VN')} ₫`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Giỏ hàng của bạn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <h2>Your coffee bag</h2>
          <button
            className="icon-button"
            aria-label="Đóng giỏ hàng"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>

        {cart.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">
              <Icon name="bag" size={40} />
            </span>
            <h3>Giỏ hàng đang trống</h3>
            <p>Hãy chọn những món yêu thích để bắt đầu ngày mới!</p>
            <button className="primary-button" onClick={onClose}>
              Khám phá đồ uống <Icon name="arrow" size={17} />
            </button>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {cart.map((item) => (
                <div className="cart-item" key={item.cartItemId}>
                  <img src={item.image} alt={item.name} />
                  <div>
                    <h4 className="font-semibold text-stone-900">{item.name}</h4>
                    <div className="text-[11px] text-stone-500">
                      Size {item.size}
                      {item.toppings.length > 0 &&
                        ` • +${item.toppings.length} topping`}
                    </div>
                    <span className="font-bold text-amber-600 text-xs">
                      {formatMoney(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                  <div className="quantity-controls">
                    <button
                      onClick={() => onUpdateQuantity(item.cartItemId, -1)}
                      aria-label="Giảm số lượng"
                    >
                      −
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      onClick={() => onUpdateQuantity(item.cartItemId, 1)}
                      aria-label="Tăng số lượng"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="checkout-total">
              <span>Tổng cộng:</span>
              <strong>{formatMoney(total)}</strong>
            </div>

            <button
              className="primary-button checkout"
              onClick={onCheckout}
            >
              Tiến hành thanh toán
              <Icon name="arrow" />
            </button>
            <p className="demo-note">Chọn phương thức và nhập mã giảm giá ở bước sau</p>
          </>
        )}
      </section>
    </div>
  );
}
