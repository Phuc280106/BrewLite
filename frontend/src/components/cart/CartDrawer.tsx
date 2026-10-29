'use client';

import React from 'react';
import { CartItem, CheckoutError } from '../../types';
import Icon from '../common/Icon';
import { useViewStore } from '../../store/useViewStore';

interface CartDrawerProps {
  isOpen: boolean;
  cart: CartItem[];
  total: number;
  ordered: boolean;
  isSubmitting: boolean;
  orderCode: string | null;
  orderStatus?: string | null;
  checkoutError: CheckoutError | null;
  onClose: () => void;
  onUpdateQuantity: (cartItemId: string, change: number) => void;
  onCheckout: () => void;
  formatPrice?: (price: number) => string;
}

export default function CartDrawer({
  isOpen,
  cart,
  total,
  ordered,
  isSubmitting,
  orderCode,
  orderStatus,
  checkoutError,
  onClose,
  onUpdateQuantity,
  onCheckout,
  formatPrice = (val: number) => `${val.toLocaleString('vi-VN')} ₫`,
}: CartDrawerProps) {
  if (!isOpen) return null;

  const setCurrentView = useViewStore((state) => state.setCurrentView);

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
          <h2>{ordered ? 'Xác nhận đơn hàng' : 'Your coffee bag'}</h2>
          <button
            className="icon-button"
            aria-label="Đóng giỏ hàng"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>

        {ordered ? (
          <div className="empty-state">
            <span className="empty-icon bg-emerald-100 text-emerald-600">
              <Icon name="check" size={40} />
            </span>
            <h3 className="text-xl font-bold text-stone-900 mt-2">
              Đặt hàng thành công!
            </h3>
            <p className="text-sm text-stone-600 mt-1 max-w-xs mx-auto">
              Cảm ơn bạn đã lựa chọn BrewLite. Đơn hàng của bạn đã được ghi nhận trên hệ thống.
            </p>

            {/* Chi tiết xác nhận đơn hàng theo US-09 */}
            <div className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 my-4 text-left space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  Mã đơn hàng
                </span>
                <span className="font-mono font-bold text-base text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                  {orderCode || 'BL-000000'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  Trạng thái
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  {orderStatus || 'PENDING (Chờ xử lý)'}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 w-full mt-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  setCurrentView('orders');
                }}
                className="primary-button text-center flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-bold cursor-pointer border-none"
              >
                <span>Xem lịch sử đơn</span>
                <Icon name="arrow" size={16} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-semibold transition-colors cursor-pointer border-none"
              >
                Tiếp tục đặt món
              </button>
            </div>
          </div>
        ) : cart.length === 0 ? (
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
                      {formatPrice(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                  <div className="quantity-controls">
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(item.cartItemId, -1)}
                      aria-label="Giảm số lượng"
                    >
                      −
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
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
              <span>Tạm tính giỏ hàng:</span>
              <strong>{formatPrice(total)}</strong>
            </div>

            {checkoutError && (
              <p role="alert" className="text-sm text-red-600 mb-3">
                {Array.isArray(checkoutError.message)
                  ? checkoutError.message.join(', ')
                  : checkoutError.message ??
                    'Could not place the order. Please try again.'}
              </p>
            )}

            <button
              type="button"
              className="primary-button checkout"
              onClick={onCheckout}
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? 'Đang mở thanh toán...' : 'Tiến hành thanh toán'}
              {!isSubmitting && <Icon name="arrow" />}
            </button>
            <p className="demo-note">Chọn ví MoMo / VNPay / Thẻ & Áp mã giảm giá</p>
          </>
        )}
      </section>
    </div>
  );
}
