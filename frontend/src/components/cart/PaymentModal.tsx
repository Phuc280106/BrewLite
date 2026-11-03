'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import {
  CartItem,
  CreateOrderResponse,
  InitiatePaymentResponse,
  Promotion,
  ValidatePromotionResponse,
} from '@/types';

export interface VnpayPaymentOption {
  id: string;
  bankCode?: string;
  name: string;
  tag: string;
  tagColor: string;
  desc: string;
  icon: string;
}

export const VNPAY_PAYMENT_OPTIONS: VnpayPaymentOption[] = [
  {
    id: 'VNPAY_ALL',
    bankCode: undefined,
    name: 'Cổng VNPay',
    tag: 'Sandbox',
    tagColor: 'bg-blue-600 text-white',
    desc: 'Tự chọn phương thức tại Cổng thanh toán VNPay',
    icon: '🏦',
  },
  {
    id: 'VNPAY_QR',
    bankCode: 'VNPAYQR',
    name: 'VNPAY-QR',
    tag: 'App Bank',
    tagColor: 'bg-rose-600 text-white',
    desc: 'Quét mã QR từ hơn 40 ứng dụng ngân hàng & ví điện tử',
    icon: '📱',
  },
  {
    id: 'VNPAY_ATM',
    bankCode: 'VNBANK',
    name: 'Thẻ ATM nội địa',
    tag: 'Napas',
    tagColor: 'bg-emerald-600 text-white',
    desc: 'Tài khoản & Thẻ ATM các ngân hàng nội địa (NCB, Vietcombank...)',
    icon: '🏧',
  },
  {
    id: 'VNPAY_INT',
    bankCode: 'INTCARD',
    name: 'Thẻ quốc tế',
    tag: 'Visa/Master',
    tagColor: 'bg-purple-600 text-white',
    desc: 'Thẻ thanh toán quốc tế Visa, MasterCard, JCB',
    icon: '💳',
  },
];

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  subtotal: number;
}

export default function PaymentModal({
  isOpen,
  onClose,
  cart,
  subtotal,
}: PaymentModalProps) {
  const user = useAuthStore((state) => state.user);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);

  // Tùy chọn thanh toán VNPay được chọn
  const [selectedOptionId, setSelectedOptionId] = useState<string>('VNPAY_ALL');

  // Khuyến mãi
  const [couponInput, setCouponInput] = useState('');
  const [appliedPromotion, setAppliedPromotion] =
    useState<ValidatePromotionResponse | null>(null);
  const [availablePromotions, setAvailablePromotions] = useState<Promotion[]>([]);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Điểm thưởng tích lũy (Loyalty Points)
  const [pointsInput, setPointsInput] = useState<string>('');

  // Trạng thái khởi tạo thanh toán
  const [isInitiating, setIsInitiating] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);

  // Lấy danh sách mã khuyến mãi gợi ý khi mở modal
  useEffect(() => {
    if (!isOpen) return;

    const fetchPromotions = async () => {
      try {
        const res = await api.get<Promotion[]>('/orders/promotions');
        setAvailablePromotions(res.data);
      } catch {
        setAvailablePromotions([
          {
            id: 1,
            code: 'BREW10',
            description: 'Giảm 10% tổng đơn hàng (đơn tối thiểu 50.000đ)',
            discountPercent: 10,
            discountAmount: null,
            minOrder: 50000,
            isActive: true,
          },
          {
            id: 2,
            code: 'CHAOBAN',
            description: 'Giảm ngay 20.000đ cho đơn từ 40.000đ',
            discountPercent: null,
            discountAmount: 20000,
            minOrder: 40000,
            isActive: true,
          },
          {
            id: 3,
            code: 'FREESHIP',
            description: 'Hỗ trợ 15.000đ phí giao hàng cho đơn từ 60.000đ',
            discountPercent: null,
            discountAmount: 15000,
            minOrder: 60000,
            isActive: true,
          },
          {
            id: 4,
            code: 'VIP20',
            description: 'Ưu đãi thành viên VIP: Giảm 20% cho đơn từ 100.000đ',
            discountPercent: 20,
            discountAmount: null,
            minOrder: 100000,
            isActive: true,
          },
        ]);
      }
    };

    void fetchPromotions();
  }, [isOpen]);

  if (!isOpen) return null;

  const discountAmount = appliedPromotion ? appliedPromotion.discount : 0;
  const subtotalAfterCoupon = Math.max(0, subtotal - discountAmount);

  // Tỉ lệ: 1 điểm = 1.000 VNĐ
  const userPoints = user?.loyaltyPoints || 0;
  const maxPointsCanUse = Math.min(
    userPoints,
    Math.floor(subtotalAfterCoupon / 1000)
  );

  const parsedPoints = parseInt(pointsInput, 10);
  const pointsUsed =
    !isNaN(parsedPoints) && parsedPoints > 0
      ? Math.min(parsedPoints, maxPointsCanUse)
      : 0;
  const pointDiscount = pointsUsed * 1000;
  const finalTotal = Math.max(0, subtotalAfterCoupon - pointDiscount);

  const formatMoney = (val: number) =>
    `${Math.round(val).toLocaleString('vi-VN')} ₫`;

  // Xử lý áp dụng mã khuyến mãi
  const handleApplyCoupon = async (codeToApply?: string) => {
    const rawCode = codeToApply ?? couponInput;
    const cleanCode = rawCode.trim().toUpperCase();

    if (!cleanCode) {
      setCouponError('Vui lòng nhập mã khuyến mãi');
      return;
    }

    setIsValidatingCoupon(true);
    setCouponError(null);

    try {
      const userParam = user ? `&userId=${user.id}` : '';
      const res = await api.get<ValidatePromotionResponse>(
        `/orders/promotions/validate?code=${encodeURIComponent(
          cleanCode
        )}&subtotal=${subtotal}${userParam}`
      );
      setAppliedPromotion(res.data);
      setCouponInput(cleanCode);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setCouponError(
          err.response?.data?.message ||
            'Mã khuyến mãi không hợp lệ hoặc không đủ điều kiện'
        );
      } else {
        setCouponError('Không thể kiểm tra mã khuyến mãi');
      }
      setAppliedPromotion(null);
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedPromotion(null);
    setCouponInput('');
    setCouponError(null);
  };

  // Xử lý bấm "Tiến hành thanh toán" -> Gọi Backend sinh URL VNPay Sandbox và Redirect
  const handleInitiatePayment = async () => {
    if (!user) {
      openAuthModal('login', 'Vui lòng đăng nhập để tiến hành thanh toán đơn hàng');
      return;
    }

    if (cart.length === 0) return;

    setIsInitiating(true);
    setPaymentError(null);

    let activeOrderId = pendingOrderId;

    try {
      // 1. Tạo đơn hàng PENDING nếu chưa có
      if (!activeOrderId) {
        const orderRes = await api.post<CreateOrderResponse>('/orders', {
          items: cart.map(({ productId, size, toppings, quantity }) => ({
            productId,
            size,
            toppings: (toppings || []).filter((t) =>
              ['pearl', 'cheese', 'peach_jelly'].includes(t)
            ),
            quantity,
          })),
          couponCode: appliedPromotion ? appliedPromotion.code : undefined,
          pointsUsed: pointsUsed > 0 ? pointsUsed : undefined,
        });

        activeOrderId = orderRes.data.orderId;
        setPendingOrderId(activeOrderId);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('brewlite:refresh-products'));
        }
      }

      const selectedOpt =
        VNPAY_PAYMENT_OPTIONS.find((opt) => opt.id === selectedOptionId) ||
        VNPAY_PAYMENT_OPTIONS[0];

      // 2. Khởi tạo phiên thanh toán VNPay Sandbox (kèm mã tab bankCode nếu có)
      const initRes = await api.post<InitiatePaymentResponse>(
        '/payments/initiate',
        {
          orderId: activeOrderId,
          method: 'VNPAY',
          bankCode: selectedOpt.bankCode,
        }
      );

      // 3. Chuyển hướng trực tiếp sang Cổng VNPay Sandbox
      if (initRes.data.paymentUrl) {
        window.location.href = initRes.data.paymentUrl;
        return;
      }

      throw new Error('Cổng thanh toán không trả về đường dẫn thanh toán hợp lệ');
    } catch (err) {
      console.error('Initiate payment error:', err);
      let errorMsg =
        'Không thể khởi tạo phiên thanh toán VNPay. Vui lòng kiểm tra lại.';

      if (axios.isAxiosError(err)) {
        if (err.response?.data?.message) {
          const raw = err.response.data.message;
          errorMsg = Array.isArray(raw) ? raw.join(', ') : raw;
        } else if (err.response?.status === 409) {
          errorMsg = 'Sản phẩm trong giỏ đã có sự thay đổi về số lượng tồn kho.';
        }
      }

      setPaymentError(errorMsg);
      setIsInitiating(false);
    }
  };

  const handleModalClose = () => {
    setPaymentError(null);
    setPendingOrderId(null);
    setPointsInput('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={handleModalClose}
    >
      <div
        className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-stone-200/80 p-5 sm:p-7 relative text-stone-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nút đóng */}
        <button
          type="button"
          onClick={handleModalClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-800 flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
          aria-label="Đóng"
        >
          ✕
        </button>

        <div className="space-y-5">
          {/* Tiêu đề Modal */}
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 mb-2">
              <span>🏦 Cổng VNPay Sandbox</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-stone-900">
              Thanh toán đơn hàng
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 mt-1">
              Kiểm tra ưu đãi và chọn phương thức thanh toán bảo mật qua Cổng VNPay
            </p>
          </div>

          {/* Chọn 1 trong 4 hình thức thanh toán của VNPay */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Chọn phương thức thanh toán
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {VNPAY_PAYMENT_OPTIONS.map((opt) => {
                const isSelected = selectedOptionId === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedOptionId(opt.id)}
                    className={`p-3 rounded-2xl border-2 text-left transition-all flex items-start gap-2.5 relative cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 shadow-sm ring-2 ring-blue-500/20'
                        : 'border-stone-200 hover:border-stone-300 bg-white'
                    }`}
                  >
                    <span className="text-2xl flex-shrink-0 mt-0.5">{opt.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-stone-900 truncate">
                          {opt.name}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider ${opt.tagColor}`}
                        >
                          {opt.tag}
                        </span>
                      </div>
                      <span className="text-[10px] text-stone-500 line-clamp-2 mt-0.5 leading-snug">
                        {opt.desc}
                      </span>
                    </div>
                    {isSelected && (
                      <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-blue-200" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Khối Nhập mã khuyến mại (Coupon) */}
          <div className="space-y-2.5 pt-2 border-t border-stone-100">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center justify-between">
              <span>Mã khuyến mãi</span>
              {appliedPromotion && (
                <span className="text-emerald-600 font-semibold lowercase">
                  Đã áp dụng mã thành công
                </span>
              )}
            </label>

            {appliedPromotion ? (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-emerald-800 font-mono text-sm">
                    {appliedPromotion.code}
                  </span>
                  <span className="text-emerald-700">
                    - Giảm {formatMoney(appliedPromotion.discount)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  className="text-stone-400 hover:text-stone-700 font-bold px-2 py-1 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  Gỡ bỏ
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value);
                    if (couponError) setCouponError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleApplyCoupon();
                    }
                  }}
                  placeholder="Nhập mã voucher (BREW10, CHAOBAN...)"
                  className="flex-1 px-3.5 py-2.5 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono uppercase bg-stone-50"
                />
                <button
                  type="button"
                  onClick={() => void handleApplyCoupon()}
                  disabled={isValidatingCoupon || !couponInput.trim()}
                  className="px-4 py-2.5 text-xs font-bold rounded-xl bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
                >
                  {isValidatingCoupon ? 'Đang kiểm tra...' : 'Áp dụng'}
                </button>
              </div>
            )}

            {couponError && (
              <p className="text-[11px] text-rose-600 font-medium">
                {couponError}
              </p>
            )}

            {/* Gợi ý mã khuyến mãi */}
            {!appliedPromotion && availablePromotions.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-stone-400">
                  Mã khuyến mãi có thể dùng:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {availablePromotions.map((p) => {
                    const isEligible = subtotal >= (p.minOrder || 0);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => void handleApplyCoupon(p.code)}
                        className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                          isEligible
                            ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                            : 'bg-stone-100 text-stone-400 border-stone-200 hover:bg-stone-200'
                        }`}
                        title={p.description || undefined}
                      >
                        {p.code}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Khối Đổi điểm thưởng tích lũy (Loyalty Points) */}
          <div className="space-y-2.5 pt-2 border-t border-stone-100">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center justify-between">
              <span>Điểm thưởng thành viên</span>
              {user ? (
                <span className="text-amber-800 font-bold font-mono">
                  Khả dụng: {user.loyaltyPoints.toLocaleString('vi-VN')} điểm
                </span>
              ) : (
                <span className="text-stone-400 font-normal lowercase text-[11px]">
                  Đăng nhập để đổi điểm
                </span>
              )}
            </label>

            {user ? (
              <div className="space-y-2">
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min={0}
                    max={maxPointsCanUse}
                    value={pointsInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setPointsInput('');
                        return;
                      }
                      const num = parseInt(val, 10);
                      if (isNaN(num) || num < 0) {
                        setPointsInput('0');
                      } else if (num > maxPointsCanUse) {
                        setPointsInput(String(maxPointsCanUse));
                      } else {
                        setPointsInput(String(num));
                      }
                    }}
                    placeholder={`Nhập điểm muốn dùng (tối đa ${maxPointsCanUse})`}
                    className="flex-1 px-3.5 py-2.5 rounded-2xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono text-xs sm:text-sm"
                  />
                  <button
                    type="button"
                    disabled={maxPointsCanUse <= 0}
                    onClick={() => setPointsInput(String(maxPointsCanUse))}
                    className="px-3 py-2.5 bg-amber-100 hover:bg-amber-200 disabled:opacity-40 text-amber-900 font-bold rounded-2xl text-xs transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Dùng tối đa
                  </button>
                  {pointsUsed > 0 && (
                    <button
                      type="button"
                      onClick={() => setPointsInput('')}
                      className="px-2.5 py-2.5 text-stone-400 hover:text-stone-600 font-bold text-xs cursor-pointer"
                    >
                      Xóa
                    </button>
                  )}
                </div>

                <div className="flex justify-between items-center text-[11px] text-stone-500">
                  <span>Tỉ lệ: 1 điểm = 1.000 ₫</span>
                  {pointsUsed > 0 && (
                    <span className="text-amber-700 font-semibold">
                      Giảm thêm: -{formatMoney(pointDiscount)}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 text-xs text-stone-600 flex justify-between items-center">
                <span>Đăng nhập tài khoản để tích lũy và sử dụng điểm thưởng.</span>
                <button
                  type="button"
                  onClick={() => openAuthModal('login')}
                  className="text-amber-700 hover:bg-amber-100 px-2 py-1 rounded-lg font-bold underline ml-2 transition-colors cursor-pointer"
                >
                  Đăng nhập ngay
                </button>
              </div>
            )}
          </div>

          {/* Tóm tắt số tiền */}
          <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200/80 space-y-2 text-xs">
            <div className="flex justify-between items-center text-stone-600">
              <span>Tạm tính giỏ hàng ({cart.length} món):</span>
              <span className="font-semibold">{formatMoney(subtotal)}</span>
            </div>

            {appliedPromotion && (
              <div className="flex justify-between items-center text-emerald-600 font-semibold">
                <span>Khuyến mãi ({appliedPromotion.code}):</span>
                <span>-{formatMoney(discountAmount)}</span>
              </div>
            )}

            {pointDiscount > 0 && (
              <div className="flex justify-between items-center text-amber-700 font-semibold">
                <span>Điểm thưởng giảm trừ ({pointsUsed} điểm):</span>
                <span>-{formatMoney(pointDiscount)}</span>
              </div>
            )}

            <div className="pt-2 border-t border-stone-200 flex justify-between items-center text-sm font-extrabold text-stone-900">
              <span>Tổng thanh toán:</span>
              <span className="text-amber-700 font-mono text-base">
                {formatMoney(finalTotal)}
              </span>
            </div>
          </div>

          {/* Thông báo lỗi thanh toán nếu có */}
          {paymentError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs space-y-1">
              <div className="font-bold">Không thể tiếp tục thanh toán:</div>
              <div>{paymentError}</div>
            </div>
          )}

          {/* Nút hành động */}
          <button
            type="button"
            onClick={handleInitiatePayment}
            disabled={isInitiating || cart.length === 0}
            className="w-full py-4 px-5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-extrabold rounded-2xl shadow-lg shadow-blue-600/25 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            {isInitiating ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Đang kết nối Cổng VNPay...</span>
              </>
            ) : (
              <>
                <span>Tiến hành thanh toán</span>
                <span className="font-normal opacity-90">({formatMoney(finalTotal)})</span>
                <span>→</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
