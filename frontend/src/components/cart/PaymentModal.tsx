'use client';

import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { useCartStore } from './useCartStore';
import {
  CartItem,
  CreateOrderResponse,
  InitiatePaymentResponse,
  OrderStatusResponse,
  PaymentIntent,
  PaymentMethod,
  Promotion,
  ValidatePromotionResponse,
} from '@/types';

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
  const clearCart = useCartStore((state) => state.clearCart);

  // Phương thức thanh toán
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('VIETQR');

  // Khuyến mãi
  const [couponInput, setCouponInput] = useState('');
  const [appliedPromotion, setAppliedPromotion] =
    useState<ValidatePromotionResponse | null>(null);
  const [availablePromotions, setAvailablePromotions] = useState<Promotion[]>([]);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Trạng thái phiên thanh toán
  const [isInitiating, setIsInitiating] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);
  const [pendingOrderCode, setPendingOrderCode] = useState<string | null>(null);
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent | null>(null);
  const [isAwaitingPayment, setIsAwaitingPayment] = useState(false);

  // Trạng thái mô phỏng ngân hàng
  const [isSimulatingBank, setIsSimulatingBank] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Màn hình thành công (PAID)
  const [paidResult, setPaidResult] = useState<{
    orderCode: string;
    amount: number;
    methodTitle: string;
    loyaltyPointsEarned?: number;
    discount: number;
    couponCode?: string | null;
  } | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Lấy danh sách mã khuyến mãi gợi ý từ server khi mở modal
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

  const discountAmount = appliedPromotion ? appliedPromotion.discount : 0;
  const finalTotal = Math.max(0, subtotal - discountAmount);

  // Polling Realtime kiểm tra trạng thái đơn hàng khi đang ở màn hình chờ quét QR
  useEffect(() => {
    if (!isAwaitingPayment || !pendingOrderId) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const checkOrderStatus = async () => {
      try {
        const res = await api.get<OrderStatusResponse>(
          `/payments/status/${pendingOrderId}`
        );

        if (res.data.status === 'PAID') {
          // Ngân hàng đã xác nhận Webhook thành công!
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }

          setPaidResult({
            orderCode:
              res.data.orderCode ||
              `BL-${String(pendingOrderId).padStart(6, '0')}`,
            amount: res.data.total,
            methodTitle: getMethodTitle(selectedMethod),
            loyaltyPointsEarned: Math.floor(res.data.total / 10000),
            discount: res.data.discount || discountAmount,
            couponCode: res.data.couponCode || appliedPromotion?.code,
          });

          // Làm sạch giỏ hàng
          clearCart();
          setIsAwaitingPayment(false);
          setPendingOrderId(null);
          setPendingOrderCode(null);
        } else if (res.data.status === 'PAYMENT_FAILED') {
          setPaymentError('Ngân hàng từ chối thanh toán. Vui lòng thử lại.');
          setIsAwaitingPayment(false);
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      } catch (err) {
        console.warn('Lỗi kiểm tra trạng thái đơn:', err);
      }
    };

    // Kiểm tra ngay 1 lần và lập lịch mỗi 2 giây
    void checkOrderStatus();
    pollingRef.current = setInterval(checkOrderStatus, 2000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isAwaitingPayment, pendingOrderId, selectedMethod, discountAmount, appliedPromotion, clearCart]);

  if (!isOpen) return null;

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
      const res = await api.get<ValidatePromotionResponse>(
        `/orders/promotions/validate?code=${encodeURIComponent(
          cleanCode
        )}&subtotal=${subtotal}`
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

  // Tên hiển thị của phương thức
  function getMethodTitle(method: PaymentMethod) {
    switch (method) {
      case 'VIETQR':
        return 'Chuyển khoản VietQR Napas 24/7';
      case 'MOMO':
        return 'Ví điện tử MoMo';
      case 'VNPAY':
        return 'Ví điện tử VNPay / VNPAY-QR';
      case 'CARD':
        return 'Thẻ ngân hàng / Thẻ quốc tế';
    }
  };

  // 1. Xử lý bấm "Tiến hành thanh toán" -> Gọi POST /payments/initiate
  const handleInitiatePayment = async () => {
    if (!user) {
      openAuthModal('login', 'Vui lòng đăng nhập để tiến hành thanh toán đơn hàng');
      return;
    }

    if (cart.length === 0) return;

    setIsInitiating(true);
    setPaymentError(null);

    let activeOrderId = pendingOrderId;
    let activeOrderCode = pendingOrderCode;

    try {
      // 1. Tạo đơn hàng PENDING nếu chưa có
      if (!activeOrderId) {
        const orderRes = await api.post<CreateOrderResponse>('/orders', {
          items: cart.map(({ productId, size, toppings, quantity }) => ({
            productId,
            size,
            toppings,
            quantity,
          })),
          couponCode: appliedPromotion ? appliedPromotion.code : undefined,
        });

        activeOrderId = orderRes.data.orderId;
        activeOrderCode = orderRes.data.orderCode;
        setPendingOrderId(activeOrderId);
        setPendingOrderCode(activeOrderCode);
      }

      // 2. Gọi Cổng thanh toán để tạo phiên thanh toán & sinh VietQR
      const initRes = await api.post<InitiatePaymentResponse>(
        '/payments/initiate',
        {
          orderId: activeOrderId,
          method: selectedMethod,
        }
      );

      setPaymentIntent(initRes.data.paymentIntent);
      setIsAwaitingPayment(true);
    } catch (err) {
      console.error('Initiate payment error:', err);
      let errorMsg =
        'Không thể khởi tạo phiên thanh toán. Vui lòng kiểm tra lại.';

      if (axios.isAxiosError(err)) {
        if (err.response?.data?.message) {
          const raw = err.response.data.message;
          errorMsg = Array.isArray(raw) ? raw.join(', ') : raw;
        } else if (err.response?.status === 409) {
          errorMsg = 'Sản phẩm trong giỏ đã có sự thay đổi về số lượng tồn kho.';
        }
      }

      setPaymentError(errorMsg);
    } finally {
      setIsInitiating(false);
    }
  };

  // 2. Mô phỏng Ngân hàng gửi Webhook (Demo trên lớp)
  const handleSimulateBankConfirm = async () => {
    if (!pendingOrderId) return;
    setIsSimulatingBank(true);
    setPaymentError(null);

    try {
      const res = await api.post<{
        success: boolean;
        status: string;
        loyaltyPointsEarned?: number;
      }>('/payments/mock-bank/confirm', {
        orderId: pendingOrderId,
      });

      if (res.data.status === 'PAID') {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }

        setPaidResult({
          orderCode:
            pendingOrderCode ||
            `BL-${String(pendingOrderId).padStart(6, '0')}`,
          amount: paymentIntent?.amount || finalTotal,
          methodTitle: getMethodTitle(selectedMethod),
          loyaltyPointsEarned:
            res.data.loyaltyPointsEarned ?? Math.floor(finalTotal / 10000),
          discount: discountAmount,
          couponCode: appliedPromotion?.code,
        });

        clearCart();
        setIsAwaitingPayment(false);
        setPendingOrderId(null);
        setPendingOrderCode(null);
      }
    } catch (err) {
      console.error('Simulate error:', err);
      setPaymentError('Không thể gửi tín hiệu giả lập từ Ngân hàng.');
    } finally {
      setIsSimulatingBank(false);
    }
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleFinishAndClose = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setPaidResult(null);
    setPaymentIntent(null);
    setIsAwaitingPayment(false);
    setIsSimulatingBank(false);
    setPendingOrderId(null);
    setPendingOrderCode(null);
    setAppliedPromotion(null);
    setCouponInput('');
    setPaymentError(null);
    onClose();
  };

  const handleModalClose = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsAwaitingPayment(false);
    setIsSimulatingBank(false);
    setPaymentError(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={paidResult ? handleFinishAndClose : handleModalClose}
    >
      <div
        className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-stone-200/80 p-5 sm:p-7 relative text-stone-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nút đóng */}
        <button
          type="button"
          onClick={paidResult ? handleFinishAndClose : handleModalClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-800 flex items-center justify-center font-bold text-sm transition-colors"
          aria-label="Đóng"
        >
          ✕
        </button>

        {/* 1. MÀN HÌNH XÁC NHẬN THÀNH CÔNG (PAID) */}
        {paidResult ? (
          <div className="text-center py-4 space-y-5 animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner ring-8 ring-emerald-50">
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white tracking-wider uppercase mb-2 shadow-sm">
                <span>Webhook Verified:</span>
                <span className="bg-emerald-800/80 px-2 py-0.5 rounded-full">PAID</span>
              </div>
              <h2 className="text-2xl font-extrabold text-stone-900">
                Thanh toán thành công!
              </h2>
            </div>

            <div className="bg-stone-50 rounded-2xl p-4.5 text-left border border-stone-200/80 space-y-2.5 text-xs sm:text-sm">
              <div className="flex justify-between items-center pb-2 border-b border-stone-200">
                <span className="text-stone-500">Mã đơn hàng</span>
                <span className="font-mono font-bold text-stone-900 text-sm">
                  {paidResult.orderCode}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-stone-500">Phương thức</span>
                <span className="font-semibold text-stone-800">
                  {paidResult.methodTitle}
                </span>
              </div>

              {paidResult.couponCode && (
                <div className="flex justify-between items-center text-emerald-600">
                  <span>Mã giảm giá đã dùng</span>
                  <span className="font-semibold">
                    {paidResult.couponCode} (-{formatMoney(paidResult.discount)})
                  </span>
                </div>
              )}

              {paidResult.loyaltyPointsEarned != null && paidResult.loyaltyPointsEarned > 0 && (
                <div className="flex justify-between items-center text-amber-700 font-semibold bg-amber-50 p-2 rounded-xl border border-amber-200">
                  <span>Điểm thưởng tích lũy</span>
                  <span>+{paidResult.loyaltyPointsEarned} điểm</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-stone-200 text-base font-bold text-stone-900">
                <span>Số tiền thanh toán</span>
                <span className="text-emerald-700 font-mono">
                  {formatMoney(paidResult.amount)}
                </span>
              </div>
            </div>

            <p className="text-xs text-stone-400">
              Giỏ hàng của bạn đã được làm sạch tự động.
            </p>

            <button
              type="button"
              onClick={handleFinishAndClose}
              className="w-full py-3.5 px-4 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold rounded-2xl shadow-lg shadow-amber-600/25 transition-all text-sm flex items-center justify-center gap-2"
            >
              Hoàn tất & Tiếp tục gọi món
            </button>
          </div>
        ) : isAwaitingPayment && paymentIntent ? (
          /* 2. MÀN HÌNH CHỜ QUÉT MÃ VIETQR NAPAS 24/7 */
          <div className="py-2 space-y-4 animate-fadeIn">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 mb-2">
                <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping"></span>
                <span>Chờ Ngân hàng xác nhận Webhook (PENDING)</span>
              </div>
              <h2 className="text-xl font-extrabold text-stone-900">
                Quét mã VietQR Napas 24/7
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Mở app Mobile Banking bất kỳ để quét mã và chuyển khoản tự động
              </p>
            </div>

            {/* Khung QR Code */}
            <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200 text-center flex flex-col items-center justify-center shadow-inner">
              <div className="bg-white p-3 rounded-2xl shadow-md border border-stone-200 max-w-[220px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={paymentIntent.qrCodeUrl}
                  alt="VietQR Napas 24/7"
                  className="w-full h-auto object-contain rounded-lg"
                />
              </div>

              <div className="mt-3 text-xs text-stone-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Hệ thống đang tự động lắng nghe Webhook...</span>
              </div>
            </div>

            {/* Thông tin chuyển khoản sao chép */}
            <div className="bg-stone-50/80 rounded-2xl p-3.5 border border-stone-200 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-stone-500">Ngân hàng thụ hưởng:</span>
                <span className="font-bold text-stone-800">
                  {paymentIntent.bankInfo.bankName}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-stone-500">Số tài khoản:</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-stone-900">
                    {paymentIntent.bankInfo.accountNo}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        paymentIntent.bankInfo.accountNo,
                        'accountNo'
                      )
                    }
                    className="text-[10px] text-amber-700 bg-amber-100 hover:bg-amber-200 px-1.5 py-0.5 rounded font-semibold transition-colors"
                  >
                    {copiedField === 'accountNo' ? 'Đã chép!' : 'Chép'}
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-stone-500">Chủ tài khoản:</span>
                <span className="font-semibold text-stone-800">
                  {paymentIntent.bankInfo.accountName}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-stone-500">Nội dung chuyển khoản:</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                    {paymentIntent.orderCode.replace('-', '')}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        paymentIntent.orderCode.replace('-', ''),
                        'content'
                      )
                    }
                    className="text-[10px] text-amber-700 bg-amber-100 hover:bg-amber-200 px-1.5 py-0.5 rounded font-semibold transition-colors"
                  >
                    {copiedField === 'content' ? 'Đã chép!' : 'Chép'}
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-stone-200 font-bold">
                <span className="text-stone-700">Tổng số tiền:</span>
                <span className="text-emerald-700 text-sm font-mono">
                  {formatMoney(paymentIntent.amount)}
                </span>
              </div>
            </div>

            {/* BẢNG ĐIỀU KHIỂN GIẢ LẬP NGÂN HÀNG (DÀNH CHO DEMO ĐỒ ÁN) */}
            <div className="bg-amber-50/70 border-2 border-dashed border-amber-300 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-base">🛠️</span>
                <div>
                  <h4 className="text-xs font-bold text-amber-900">
                    Bảng điều khiển Giả lập Ngân hàng (Mock Sandbox)
                  </h4>
                  <p className="text-[11px] text-amber-700">
                    Bấm nút bên dưới để mô phỏng Ngân hàng gửi Webhook có chữ ký HMAC vào Backend:
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSimulateBankConfirm}
                disabled={isSimulatingBank}
                className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl shadow text-xs flex items-center justify-center gap-2 transition-colors"
              >
                {isSimulatingBank ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Đang bắn Webhook HMAC-SHA256...</span>
                  </>
                ) : (
                  <>
                    <span>🟢 [DEMO] Giả lập Khách chuyển khoản thành công</span>
                  </>
                )}
              </button>
            </div>

            {paymentError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {paymentError}
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsAwaitingPayment(false)}
              className="w-full py-2 text-stone-500 hover:text-stone-800 font-semibold text-xs text-center"
            >
              ← Quay lại đổi phương thức khác
            </button>
          </div>
        ) : (
          /* 3. MÀN HÌNH CHỌN PHƯƠNG THỨC & ÁP MÃ GIẢM GIÁ (BƯỚC ĐẦU) */
          <div className="space-y-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-stone-900">
                Thanh toán đơn hàng
              </h2>
              <p className="text-xs sm:text-sm text-stone-500 mt-1">
                Kiểm tra ưu đãi và chọn phương thức thanh toán để nhận mã VietQR
              </p>
            </div>

            {/* Chọn phương thức thanh toán */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Chọn phương thức thanh toán
              </label>

              <div className="grid grid-cols-2 gap-2.5">
                {/* 1. VietQR Napas 24/7 (Khuyến nghị hàng đầu) */}
                <button
                  type="button"
                  onClick={() => setSelectedMethod('VIETQR')}
                  className={`p-3 rounded-2xl border-2 text-left transition-all flex items-start gap-2.5 relative ${
                    selectedMethod === 'VIETQR'
                      ? 'border-amber-600 bg-amber-50/50 shadow-sm'
                      : 'border-stone-200 hover:border-stone-300 bg-white'
                  }`}
                >
                  <span className="text-xl">⚡</span>
                  <div>
                    <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                      <span>VietQR Napas 24/7</span>
                    </div>
                    <span className="text-[10px] text-amber-700 font-semibold block mt-0.5">
                      Khuyên dùng · Miễn phí
                    </span>
                  </div>
                  {selectedMethod === 'VIETQR' && (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-600"></span>
                  )}
                </button>

                {/* 2. MoMo */}
                <button
                  type="button"
                  onClick={() => setSelectedMethod('MOMO')}
                  className={`p-3 rounded-2xl border-2 text-left transition-all flex items-start gap-2.5 relative ${
                    selectedMethod === 'MOMO'
                      ? 'border-pink-600 bg-pink-50/50 shadow-sm'
                      : 'border-stone-200 hover:border-stone-300 bg-white'
                  }`}
                >
                  <span className="text-xl">👛</span>
                  <div>
                    <div className="text-xs font-bold text-stone-900">Ví MoMo</div>
                    <span className="text-[10px] text-stone-400 block mt-0.5">
                      Quét mã QR MoMo
                    </span>
                  </div>
                  {selectedMethod === 'MOMO' && (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-pink-600"></span>
                  )}
                </button>

                {/* 3. VNPay */}
                <button
                  type="button"
                  onClick={() => setSelectedMethod('VNPAY')}
                  className={`p-3 rounded-2xl border-2 text-left transition-all flex items-start gap-2.5 relative ${
                    selectedMethod === 'VNPAY'
                      ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                      : 'border-stone-200 hover:border-stone-300 bg-white'
                  }`}
                >
                  <span className="text-xl">🏦</span>
                  <div>
                    <div className="text-xs font-bold text-stone-900">VNPay QR</div>
                    <span className="text-[10px] text-stone-400 block mt-0.5">
                      Ứng dụng ngân hàng
                    </span>
                  </div>
                  {selectedMethod === 'VNPAY' && (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-600"></span>
                  )}
                </button>

                {/* 4. Thẻ ngân hàng */}
                <button
                  type="button"
                  onClick={() => setSelectedMethod('CARD')}
                  className={`p-3 rounded-2xl border-2 text-left transition-all flex items-start gap-2.5 relative ${
                    selectedMethod === 'CARD'
                      ? 'border-stone-800 bg-stone-50 shadow-sm'
                      : 'border-stone-200 hover:border-stone-300 bg-white'
                  }`}
                >
                  <span className="text-xl">💳</span>
                  <div>
                    <div className="text-xs font-bold text-stone-900">Thẻ ATM / Visa</div>
                    <span className="text-[10px] text-stone-400 block mt-0.5">
                      Thẻ nội địa & Quốc tế
                    </span>
                  </div>
                  {selectedMethod === 'CARD' && (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-stone-900"></span>
                  )}
                </button>
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
                      (Giảm {formatMoney(appliedPromotion.discount)})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="text-stone-400 hover:text-stone-700 font-bold px-2 py-1"
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
                      setCouponError(null);
                    }}
                    placeholder="Nhập mã: BREW10, CHAOBAN..."
                    className="flex-1 px-3.5 py-2.5 rounded-2xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono uppercase text-xs sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyCoupon()}
                    disabled={isValidatingCoupon || !couponInput.trim()}
                    className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white font-bold rounded-2xl text-xs transition-colors"
                  >
                    {isValidatingCoupon ? 'Đang kiểm...' : 'Áp dụng'}
                  </button>
                </div>
              )}

              {couponError && (
                <p className="text-xs text-rose-600 font-medium">{couponError}</p>
              )}

              {/* Danh sách chip mã ưu đãi gợi ý */}
              {availablePromotions.length > 0 && !appliedPromotion && (
                <div className="pt-1">
                  <span className="text-[11px] text-stone-400 block mb-1.5">
                    Mã gợi ý cho bạn:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {availablePromotions.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleApplyCoupon(p.code)}
                        className="px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-mono text-[11px] font-semibold transition-colors flex items-center gap-1"
                      >
                        <span>{p.code}</span>
                        <span className="text-[10px] text-amber-600">
                          {p.discountPercent
                            ? `-${p.discountPercent}%`
                            : `-${formatMoney(p.discountAmount || 0)}`}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Chi tiết tính tiền */}
            <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200/80 space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between items-center text-stone-500">
                <span>Tạm tính giỏ hàng:</span>
                <span className="font-semibold text-stone-800">
                  {formatMoney(subtotal)}
                </span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between items-center text-emerald-600 font-semibold">
                  <span>Khuyến mãi giảm trừ:</span>
                  <span>-{formatMoney(discountAmount)}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-stone-200 text-base font-bold text-stone-900">
                <span>Tổng thanh toán:</span>
                <span className="text-amber-700 font-mono">
                  {formatMoney(finalTotal)}
                </span>
              </div>
            </div>

            {paymentError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {paymentError}
              </div>
            )}

            {/* Nút Khởi tạo thanh toán */}
            <button
              type="button"
              onClick={handleInitiatePayment}
              disabled={isInitiating || cart.length === 0}
              className="w-full py-3.5 px-4 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-amber-600/25 transition-all text-sm flex items-center justify-center gap-2"
            >
              {isInitiating ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Đang khởi tạo mã VietQR...</span>
                </>
              ) : (
                <>
                  <span>Lấy mã VietQR & Thanh toán ({formatMoney(finalTotal)})</span>
                  <span>→</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
