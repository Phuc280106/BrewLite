'use client';

import React from 'react';
import Icon from '../common/Icon';

interface CartBottomBarProps {
  count: number;
  total: number;
  onOpenCart: () => void;
}

export default function CartBottomBar({
  count,
  total,
  onOpenCart,
}: CartBottomBarProps) {
  const formatMoney = (val: number) => `${val.toLocaleString('vi-VN')} ₫`;

  return (
    <div className="cart-bar">
      <div className="cart-inner">
        <div className="cart-total">
          <span className="bag-outline">
            <Icon name="bag" size={23} />
            {count > 0 && <i>{count}</i>}
          </span>
          <div>
            <span>Your daily pick-me-up</span>
            <strong>{formatMoney(total)}</strong>
          </div>
        </div>

        <button className="cart-button" onClick={onOpenCart}>
          <Icon name="bag" size={18} /> View Cart{' '}
          <span className="cart-count">{count}</span>
          <Icon name="arrow" size={18} />
        </button>
      </div>
    </div>
  );
}
