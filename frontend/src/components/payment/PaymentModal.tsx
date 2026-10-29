'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import {
  PAYMENT_METHODS,
  createIdempotencyKey,
  formatMoney,
  getErrorMessage,
} from '@/lib/payment';
import { useAuthStore } from '@/store/useAuthStore';
import { usePaymentStore } from '@/store/usePaymentStore';
import {
  CartItem,
  CreateOrderResponse,
  PaymentMethodId,
  PaymentResponse,
  PromotionPreview,
} from '@/types';
import Icon from '../common/Icon';

interface PaymentModalProps {
  cart: CartItem[];
  subtotal: number;
  onClose: () => void;
  /** Gọi sau khi thanh toán thành công để xóa giỏ hàng. */
  onPaid: () => void;
}

interface PaidResult {
  orderCode: string;
  total: number;
  discount: number;
  couponCode: string | null;
  loyaltyPointsEarned: number;
}

type FailureKind = 'validation' | 'order' | 'payment';

const digitsOnly = (value: string) => value.replace(/\D/g, '');

function validateCard(number: string, expiry: string, cvv: string) {
  if (digitsOnly(number).length < 16) return 'Số thẻ phải gồm 16 chữ số';
  const match = /^(\d{2})\/(\d{2})$/.exec(expiry);
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 12) {
    return 'Ngày hết hạn không hợp lệ (MM/YY)';
  }
  if (digitsOnly(cvv).length < 3) return 'CVV phải gồm 3 chữ số';
  return null;
}

export default function PaymentModal({
  cart,
  subtotal,
  onClose,
  onPaid,
}: PaymentModalProps) {
  const pendingOrder = usePaymentStore((state) => state.pendingOrder);
  const setPendingOrder = usePaymentStore((state) => state.setPendingOrder);
  const clearPendingOrder = usePaymentStore((state) => state.clearPendingOrder);

  const cartSignature = (couponCode: string | null) =>
    JSON.stringify([
      cart.map(({ productId, size, toppings, quantity }) => [
        productId,
        size,
        [...toppings].sort(),
        quantity,
      ]),
      couponCode,
    ]);

  // Dùng lại đơn PENDING cũ nếu giỏ hàng không đổi kể từ lúc tạo đơn.
  const reusable =
    pendingOrder && pendingOrder.signature === cartSignature(pendingOrder.couponCode)
      ? pendingOrder
      : null;

  const [method, setMethod] = useState<PaymentMethodId>('MOMO');
  const [couponInput, setCouponInput] = useState(reusable?.couponCode ?? '');
  const [promo, setPromo] = useState<PromotionPreview | null>(
    reusable?.couponCode
      ? {
          code: reusable.couponCode,
          description: null,
          subtotal,
          discount: reusable.discount,
          total: reusable.total,
        }
      : null
  );
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  const [isPaying, setIsPaying] = useState(false);
  const [failure, setFailure] = useState<{ kind: FailureKind; message: string } | null>(
    null
  );
  const [paid, setPaid] = useState<PaidResult | null>(null);

  const discount = promo?.discount ?? 0;
  const total = Math.max(0, subtotal - discount);
  // Đã có đơn PENDING thì mã giảm giá đã gắn vào đơn, không đổi nữa.
  const couponLocked = reusable !== null;

  const applyCoupon = async () => {
    const code = couponInput.trim();
    if (!code || isApplying) return;
    setIsApplying(true);
    setCouponError(null);
    try {
      const response = await api.get<PromotionPreview>('/promotions/validate', {
        params: { code, subtotal },
      });
      setPromo(response.data);
      setCouponInput(response.data.code);
    } catch (error) {
      setPromo(null);
      setCouponError(getErrorMessage(error, 'Không thể kiểm tra mã khuyến mãi.'));
    } finally {
      setIsApplying(false);
    }
  };

  const removeCoupon = () => {
    setPromo(null);
    setCouponInput('');
    setCouponError(null);
  };

  const handlePay = async () => {
    if (isPaying) return;

    if (method === 'CARD') {
      const cardError = validateCard(cardNumber, cardExpiry, cardCvv);
      if (cardError) {
        setFailure({ kind: 'validation', message: cardError });
        return;
      }
    }

    setIsPaying(true);
    setFailure(null);

    // Bước 1: tạo đơn PENDING (giữ chỗ kho + áp mã giảm giá ở server).
    let order = reusable;
    if (!order) {
      const couponCode = promo?.code ?? null;
      try {
        const response = await api.post<CreateOrderResponse>('/orders', {
          items: cart.map(({ productId, size, toppings, quantity }) => ({
            productId,
            size,
            toppings,
            quantity,
          })),
          ...(couponCode ? { couponCode } : {}),
        });
        order = {
          orderId: response.data.orderId,
          orderCode: response.data.orderCode,
          total: response.data.total,
          discount: response.data.discount ?? 0,
          couponCode: response.data.couponCode ?? null,
          idempotencyKey: createIdempotencyKey(),
          signature: cartSignature(couponCode),
        };
        setPendingOrder(order);
      } catch (error) {
        setFailure({
          kind: 'order',
          message: getErrorMessage(error, 'Không thể tạo đơn hàng. Vui lòng thử lại.'),
        });
        setIsPaying(false);
        return;
      }
    }

    // Bước 2: thanh toán. Cùng một Idempotency-Key cho mọi lần thử lại của đơn
    // này, nên bấm lại / mạng lỗi cũng không bị trừ tiền hai lần.
    try {
      const apiMethod =
        PAYMENT_METHODS.find((item) => item.id === method)?.apiMethod ?? 'WALLET';
      const response = await api.post<PaymentResponse>(
        '/payments',
        { orderId: order.orderId, method: apiMethod },
        { headers: { 'Idempotency-Key': order.idempotencyKey } }
      );

      const earned = response.data.loyaltyPointsEarned ?? 0;
      if (earned > 0) {
        const { user } = useAuthStore.getState();
        if (user) {
          useAuthStore.setState({
            user: { ...user, loyaltyPoints: user.loyaltyPoints + earned },
          });
        }
      }

      setPaid({
        orderCode: order.orderCode,
        total: order.total,
        discount: order.discount,
        couponCode: order.couponCode,
        loyaltyPointsEarned: earned,
      });
      clearPendingOrder();
      onPaid();
    } catch (error) {
      // Giữ nguyên giỏ hàng và đơn PENDING để khách thử lại.
      setFailure({
        kind: 'payment',
        message: getErrorMessage(error, 'Vui lòng thử lại hoặc chọn phương thức khác.'),
      });
    } finally {
      setIsPaying(false);
    }
  };

  const displayTotal = reusable ? reusable.total : total;
  const displayDiscount = reusable ? reusable.discount : discount;

  if (paid) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <section
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-label="Thanh toán thành công"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="empty-state">
            <span className="empty-icon">
              <Icon name="check" size={40} />
            </span>
            <h3>Thanh toán thành công!</h3>
            <p>
              Mã đơn hàng: <strong>{paid.orderCode}</strong>
              <br />
              Trạng thái: <strong className="text-emerald-700">PAID</strong> · đã
              thanh toán {formatMoney(paid.total)}
              {paid.discount > 0 && (
                <>
                  <br />
                  Đã giảm {formatMoney(paid.discount)}
                  {paid.couponCode ? ` (mã ${paid.couponCode})` : ''}
                </>
              )}
              {paid.loyaltyPointsEarned > 0 && (
                <>
                  <br />+{paid.loyaltyPointsEarned} điểm thưởng
                </>
              )}
            </p>
            <button className="primary-button" onClick={onClose}>
              Tiếp tục chọn món <Icon name="arrow" size={17} />
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={isPaying ? undefined : onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Thanh toán"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <h2>Thanh toán</h2>
          <button
            className="icon-button"
            aria-label="Đóng thanh toán"
            onClick={onClose}
            disabled={isPaying}
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="space-y-5 text-stone-800">
          {/* Tóm tắt đơn */}
          <div className="rounded-2xl border border-stone-200 bg-white p-3.5 text-sm">
            <div className="max-h-28 space-y-1 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.cartItemId} className="flex justify-between gap-3">
                  <span className="truncate">
                    {item.quantity}× {item.name} ({item.size})
                  </span>
                  <span className="text-stone-500">
                    {formatMoney(item.unitPrice * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Mã giảm giá (US-10.4) */}
          <div>
            <label
              htmlFor="coupon-input"
              className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-700"
            >
              Mã khuyến mãi
            </label>
            <div className="flex gap-2">
              <input
                id="coupon-input"
                value={couponInput}
                onChange={(event) => {
                  setCouponInput(event.target.value.toUpperCase());
                  setCouponError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void applyCoupon();
                }}
                disabled={Boolean(promo) || couponLocked || isPaying}
                placeholder="VD: BREW10"
                className="min-w-0 flex-1 rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm uppercase placeholder:normal-case focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 disabled:bg-stone-100"
              />
              {promo && !couponLocked ? (
                <button
                  type="button"
                  onClick={removeCoupon}
                  disabled={isPaying}
                  className="rounded-2xl border border-stone-200 bg-white px-4 text-xs font-bold text-stone-600 hover:bg-stone-100"
                >
                  Bỏ mã
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void applyCoupon()}
                  disabled={!couponInput.trim() || isApplying || couponLocked || isPaying}
                  className="rounded-2xl bg-stone-900 px-4 text-xs font-bold text-white disabled:opacity-40"
                >
                  {isApplying ? 'Đang kiểm tra...' : 'Áp dụng'}
                </button>
              )}
            </div>
            {couponError && (
              <p role="alert" className="mt-1.5 text-xs text-red-600">
                {couponError}
              </p>
            )}
            {promo && (
              <p className="mt-1.5 text-xs font-semibold text-emerald-700">
                ✓ Đã áp dụng mã {promo.code}: giảm {formatMoney(promo.discount)}
              </p>
            )}
          </div>

          {/* Phương thức thanh toán (US-07) */}
          <fieldset disabled={isPaying}>
            <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-700">
              Phương thức thanh toán
            </legend>
            <div className="space-y-2">
              {PAYMENT_METHODS.map((item) => {
                const selected = method === item.id;
                return (
                  <label
                    key={item.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition-all ${
                      selected
                        ? 'border-amber-500 bg-amber-50/60 shadow-sm'
                        : 'border-stone-200 bg-white hover:border-stone-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment-method"
                      value={item.id}
                      checked={selected}
                      onChange={() => setMethod(item.id)}
                      className="h-4 w-4 accent-amber-600"
                    />
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-extrabold ${item.badgeClass}`}
                    >
                      {item.badge}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span className="block text-[11px] text-stone-500">
                        {item.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {method === 'CARD' && (
            <div className="space-y-2 rounded-2xl border border-stone-200 bg-white p-3.5">
              <input
                inputMode="numeric"
                autoComplete="cc-number"
                value={cardNumber}
                onChange={(event) =>
                  setCardNumber(
                    digitsOnly(event.target.value)
                      .slice(0, 16)
                      .replace(/(\d{4})(?=\d)/g, '$1 ')
                  )
                }
                placeholder="Số thẻ (16 chữ số)"
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
              <div className="flex gap-2">
                <input
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  value={cardExpiry}
                  onChange={(event) => {
                    const digits = digitsOnly(event.target.value).slice(0, 4);
                    setCardExpiry(
                      digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
                    );
                  }}
                  placeholder="MM/YY"
                  className="w-1/2 rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
                <input
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  value={cardCvv}
                  onChange={(event) => setCardCvv(digitsOnly(event.target.value).slice(0, 3))}
                  placeholder="CVV"
                  className="w-1/2 rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <p className="text-[11px] text-stone-400">
                Demo: thông tin thẻ chỉ kiểm tra trên trình duyệt, không gửi lên máy chủ.
              </p>
            </div>
          )}

          {/* Tổng tiền */}
          <div className="space-y-1 border-t border-stone-200 pt-3 text-sm">
            <div className="flex justify-between text-stone-600">
              <span>Tạm tính</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            {displayDiscount > 0 && (
              <div className="flex justify-between font-semibold text-emerald-700">
                <span>Giảm giá</span>
                <span>-{formatMoney(displayDiscount)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between">
              <span className="font-bold">Tổng thanh toán</span>
              <strong className="text-xl text-amber-600">{formatMoney(displayTotal)}</strong>
            </div>
          </div>

          {failure && (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              <strong className="block">
                {failure.kind === 'validation'
                  ? 'Thông tin thẻ chưa hợp lệ'
                  : failure.kind === 'payment'
                    ? 'Thanh toán không thành công'
                    : 'Không thể tạo đơn hàng'}
              </strong>
              {failure.kind !== 'payment' && <span>{failure.message}</span>}
            </div>
          )}

          <button
            className="primary-button checkout"
            onClick={() => void handlePay()}
            disabled={isPaying}
            aria-busy={isPaying}
          >
            {isPaying
              ? 'Đang xử lý thanh toán...'
              : failure?.kind === 'payment' && reusable
                ? `Thử thanh toán lại • ${formatMoney(displayTotal)}`
                : `Thanh toán • ${formatMoney(displayTotal)}`}
            {!isPaying && <Icon name="arrow" />}
          </button>
        </div>
      </section>
    </div>
  );
}