'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useCartStore } from '@/components/cart/useCartStore';
import { useViewStore } from '@/store/useViewStore';

interface VnpayResult {
  success: boolean;
  orderId?: number;
  orderCode?: string;
  amount?: number;
  responseCode?: string;
  isCancelled?: boolean;
  message?: string;
}

function VnpayReturnContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VnpayResult | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const clearCart = useCartStore((state) => state.clearCart);
  const setCurrentView = useViewStore((state) => state.setCurrentView);

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        const paramsObj: Record<string, string> = {};
        searchParams.forEach((val, key) => {
          paramsObj[key] = val;
        });

        // Nếu không có param VNPay thì về trang chủ
        if (!paramsObj.vnp_ResponseCode) {
          router.replace('/');
          return;
        }

        // Gọi Backend xác minh chữ ký số HMAC-SHA512
        const res = await api.get<VnpayResult>('/payments/vnpay/return', {
          params: paramsObj,
        });

        setResult(res.data);

        // Nếu thanh toán thành công -> Xóa giỏ hàng
        if (res.data.success) {
          clearCart();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('brewlite:refresh-products'));
          }
        }
      } catch (err: unknown) {
        console.error('VNPay return verification error:', err);
        setResult({
          success: false,
          message: 'Không thể xác thực giao dịch hoặc chữ ký số không hợp lệ.',
        });
      } finally {
        setLoading(false);
      }
    };

    void verifyPayment();
  }, [searchParams, router, clearCart]);

  // Xử lý khi khách bấm "Thanh toán lại" (khi gặp lỗi thẻ / số dư / OTP)
  const handleRetryPayment = async () => {
    if (!result?.orderId) {
      router.push('/');
      return;
    }

    setIsRetrying(true);
    try {
      const res = await api.post<{ paymentUrl: string }>('/payments/initiate', {
        orderId: result.orderId,
        method: 'VNPAY',
      });

      if (res.data.paymentUrl) {
        window.location.href = res.data.paymentUrl;
      } else {
        throw new Error('Không nhận được liên kết thanh toán từ máy chủ');
      }
    } catch (err: unknown) {
      console.error('Lỗi khi khởi tạo lại thanh toán:', err);
      alert('Không thể khởi tạo lại phiên thanh toán. Vui lòng kiểm tra lại trong Lịch sử đơn hàng.');
      setIsRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl border border-stone-200 text-center space-y-4">
          <div className="w-16 h-16 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <h2 className="text-lg font-bold text-stone-900">Đang đối soát giao dịch VNPay...</h2>
          <p className="text-xs text-stone-500">
            Hệ thống đang xác minh chữ ký số HMAC-SHA512 từ Cổng VNPay Sandbox. Vui lòng chờ trong giây lát.
          </p>
        </div>
      </div>
    );
  }

  const isSuccess = result?.success;
  const isCancelled = result?.isCancelled || result?.responseCode === '24';

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl border border-stone-200 text-center space-y-6 animate-fadeIn">
        {/* Biểu tượng trạng thái */}
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto text-3xl shadow-inner ${
            isSuccess
              ? 'bg-emerald-100 text-emerald-600 border-4 border-emerald-200'
              : isCancelled
              ? 'bg-stone-100 text-stone-600 border-4 border-stone-300'
              : 'bg-rose-100 text-rose-600 border-4 border-rose-200'
          }`}
        >
          {isSuccess ? '✓' : isCancelled ? '✕' : '!'}
        </div>

        {/* Tiêu đề & Thông báo */}
        <div className="space-y-1">
          <h1 className="text-xl font-extrabold text-stone-900">
            {isSuccess
              ? 'Thanh toán VNPay Thành công!'
              : isCancelled
              ? 'Đơn hàng đã được Hủy'
              : 'Thanh toán không thành công'}
          </h1>
          <p className="text-xs text-stone-500">
            {isSuccess
              ? 'Đơn hàng của bạn đã được chuyển vào hàng đợi pha chế của quán.'
              : result?.message ||
                (isCancelled
                  ? 'Bạn đã hủy giao dịch trên Cổng VNPay.'
                  : 'Giao dịch bị từ chối hoặc xảy ra lỗi trong quá trình xử lý.')}
          </p>
        </div>

        {/* Chi tiết đơn hàng khi thành công */}
        {isSuccess && (
          <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200 text-left space-y-2.5 text-xs">
            <div className="flex justify-between items-center text-stone-600">
              <span>Mã đơn hàng:</span>
              <span className="font-mono font-bold text-stone-900">{result?.orderCode}</span>
            </div>
            <div className="flex justify-between items-center text-stone-600">
              <span>Số tiền đã thanh toán:</span>
              <span className="font-bold text-amber-700">
                {(result?.amount || 0).toLocaleString('vi-VN')} ₫
              </span>
            </div>
            <div className="flex justify-between items-center text-stone-600">
              <span>Phương thức:</span>
              <span className="font-medium text-stone-800">Cổng VNPay Sandbox</span>
            </div>
            <div className="flex justify-between items-center text-stone-600">
              <span>Merchant tiếp nhận:</span>
              <span className="font-bold text-sky-700">Brewlite (OCRC6EBD)</span>
            </div>
            <div className="pt-2 border-t border-stone-200 flex justify-between items-center text-amber-800 font-semibold bg-amber-50/70 p-2 rounded-xl">
              <span>Điểm thưởng tích lũy:</span>
              <span>+{Math.floor((result?.amount || 0) / 10000)} điểm</span>
            </div>
          </div>
        )}

        {/* Nút hành động */}
        <div className="space-y-2.5 pt-2">
          {isSuccess ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setCurrentView('orders');
                  router.push('/');
                }}
                className="w-full py-3.5 px-4 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-2xl text-xs transition-colors shadow-md cursor-pointer"
              >
                Xem Lịch sử Đơn hàng
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentView('menu');
                  router.push('/');
                }}
                className="w-full py-3 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-2xl text-xs transition-colors cursor-pointer"
              >
                Về Trang chủ Thực đơn
              </button>
            </>
          ) : isCancelled ? (
            /* Khi khách chủ động bấm Hủy trên VNPay -> Đơn đã CANCELLED -> Không hiện nút thanh toán lại */
            <>
              <button
                type="button"
                onClick={() => {
                  setCurrentView('orders');
                  router.push('/');
                }}
                className="w-full py-3.5 px-4 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-2xl text-xs transition-colors shadow-md cursor-pointer"
              >
                Xem Lịch sử Đơn hàng
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentView('menu');
                  router.push('/');
                }}
                className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-2xl text-xs transition-colors cursor-pointer"
              >
                Chọn món khác tại Thực đơn
              </button>
            </>
          ) : (
            /* Khi gặp lỗi thẻ/số dư (PAYMENT_FAILED) -> Cho phép bấm Thử thanh toán lại */
            <>
              {result?.orderId && (
                <button
                  type="button"
                  onClick={handleRetryPayment}
                  disabled={isRetrying}
                  className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-extrabold rounded-2xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isRetrying ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Đang kết nối lại VNPay...</span>
                    </>
                  ) : (
                    <span>🔄 Thử thanh toán lại qua VNPay</span>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setCurrentView('orders');
                  router.push('/');
                }}
                className="w-full py-3.5 px-4 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-2xl text-xs transition-colors shadow-md cursor-pointer"
              >
                Xem Lịch sử Đơn hàng
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentView('menu');
                  router.push('/');
                }}
                className="w-full py-3 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-2xl text-xs transition-colors cursor-pointer"
              >
                Về Trang chủ Thực đơn
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VnpayReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
          <div className="w-12 h-12 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <VnpayReturnContent />
    </Suspense>
  );
}
