'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useViewStore } from '@/store/useViewStore';
import Header from '../common/Header';
import Icon from '../common/Icon';
import AuthModal from '../auth/AuthModal';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/api';
import { OrderDetail, OrderStatus } from '@/types';

export default function OrderHistoryPage() {
  const user = useAuthStore((state) => state.user);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);

  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchOrders = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const response = await api.get<OrderDetail[]>('/orders/me');
      setOrders(response.data || []);
    } catch (err: unknown) {
      console.error('Failed to load orders:', err);
      setError('Không thể tải lịch sử đơn hàng. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchOrders();
    } else {
      setIsLoading(false);
    }
  }, [user, fetchOrders]);

  const formatMoney = (val: number) => `${val.toLocaleString('vi-VN')} ₫`;

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: OrderStatus | string) => {
    switch (status) {
      case 'PENDING':
        return {
          label: 'Chờ thanh toán',
          bg: 'bg-amber-100 text-amber-900 border-amber-300',
          dot: 'bg-amber-500',
        };
      case 'PAID':
        return {
          label: 'Đã thanh toán (Chờ pha)',
          bg: 'bg-sky-100 text-sky-900 border-sky-300',
          dot: 'bg-sky-500 animate-pulse',
        };
      case 'PREPARING':
        return {
          label: 'Đang pha chế',
          bg: 'bg-orange-100 text-orange-900 border-orange-300',
          dot: 'bg-orange-500 animate-pulse',
        };
      case 'READY':
        return {
          label: 'Sẵn sàng nhận món',
          bg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          dot: 'bg-emerald-500',
        };
      case 'COMPLETED':
        return {
          label: 'Đã hoàn thành',
          bg: 'bg-stone-100 text-stone-700 border-stone-300',
          dot: 'bg-stone-400',
        };
      case 'CANCELLED':
        return {
          label: 'Đã hủy',
          bg: 'bg-rose-100 text-rose-800 border-rose-300',
          dot: 'bg-rose-500',
        };
      default:
        return {
          label: status,
          bg: 'bg-stone-100 text-stone-800 border-stone-300',
          dot: 'bg-stone-400',
        };
    }
  };

  const parseToppings = (toppings: string | string[] | null): string[] => {
    if (!toppings) return [];
    if (Array.isArray(toppings)) return toppings;
    try {
      const parsed = JSON.parse(toppings);
      return Array.isArray(parsed) ? parsed : [String(parsed)];
    } catch {
      return [toppings];
    }
  };

  // Tiến trình: PAID -> PREPARING -> READY -> COMPLETED
  const inProgressSteps = [
    { key: 'PAID', label: '1. Đã thanh toán (PAID)', icon: '💳' },
    { key: 'PREPARING', label: '2. Đang pha chế (PREPARING)', icon: '☕' },
    { key: 'READY', label: '3. Sẵn sàng nhận món (READY)', icon: '🔔' },
    { key: 'COMPLETED', label: '4. Đã hoàn tất (COMPLETED)', icon: '✓' },
  ];

  const getStepIndex = (status: OrderStatus | string) => {
    switch (status) {
      case 'PAID':
        return 0;
      case 'PREPARING':
        return 1;
      case 'READY':
        return 2;
      case 'COMPLETED':
        return 3;
      default:
        return -1;
    }
  };

  return (
    <div className="app min-h-screen flex flex-col bg-stone-50">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Tiêu đề & Nút Refresh */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-stone-200">
          <div>
            <div className="flex items-center gap-2 text-stone-500 text-xs font-semibold mb-1">
              <button
                type="button"
                onClick={() => useViewStore.getState().setCurrentView('menu')}
                className="hover:text-amber-600 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs font-semibold text-stone-500"
              >
                Trang chủ
              </button>
              <span>/</span>
              <span className="text-stone-800">Lịch sử đơn hàng</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
              Lịch sử đơn hàng của bạn
            </h1>
          </div>

          {user && (
            <button
              type="button"
              onClick={() => fetchOrders(true)}
              disabled={isRefreshing || isLoading}
              className="group self-start sm:self-center inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white hover:bg-stone-50 text-stone-700 hover:text-stone-900 text-xs sm:text-sm font-semibold border border-stone-200/90 hover:border-amber-400 shadow-xs hover:shadow-sm transition-all duration-200 cursor-pointer active:scale-95 disabled:opacity-50 whitespace-nowrap"
              title="Làm mới danh sách và tiến trình đơn hàng"
            >
              <svg
                className={`w-4 h-4 text-stone-400 group-hover:text-amber-600 transition-transform duration-500 ${
                  isRefreshing ? 'animate-spin text-amber-600' : 'group-hover:rotate-180'
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>{isRefreshing ? 'Đang làm mới...' : 'Làm mới'}</span>
            </button>
          )}
        </div>

        {/* Chưa đăng nhập */}
        {!user && !isLoading && (
          <div className="my-12 text-center bg-white border border-stone-200 rounded-3xl p-8 sm:p-12 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
              <Icon name="cup" size={32} />
            </div>
            <h2 className="text-xl font-bold text-stone-900">
              Bạn chưa đăng nhập
            </h2>
            <p className="text-stone-500 text-sm mt-2 max-w-md mx-auto">
              Vui lòng đăng nhập để xem lại lịch sử đơn hàng, điểm tích lũy và theo dõi trạng thái đơn bạn vừa đặt.
            </p>
            <button
              onClick={() => openAuthModal('login')}
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-md shadow-amber-500/25 transition-all cursor-pointer"
            >
              <span>Đăng nhập ngay</span>
              <Icon name="arrow" size={16} />
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-4 my-8">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-stone-200 p-6 animate-pulse space-y-4 shadow-sm"
              >
                <div className="flex justify-between items-center">
                  <div className="h-6 w-32 bg-stone-200 rounded-lg" />
                  <div className="h-6 w-24 bg-stone-200 rounded-full" />
                </div>
                <div className="h-4 w-48 bg-stone-200 rounded" />
                <div className="h-16 bg-stone-100 rounded-xl" />
              </div>
            ))}
          </div>
        )}

        {/* Báo lỗi */}
        {error && !isLoading && (
          <div className="my-8 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between">
            <span className="text-sm font-medium">{error}</span>
            <button
              onClick={() => fetchOrders()}
              className="px-3 py-1 bg-white rounded-lg text-xs font-bold text-rose-800 border border-rose-300 hover:bg-rose-100 transition-colors"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Đã đăng nhập nhưng không có đơn hàng nào */}
        {user && !isLoading && !error && orders.length === 0 && (
          <div className="my-12 text-center bg-white border border-stone-200 rounded-3xl p-8 sm:p-12 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto mb-4">
              <Icon name="bag" size={32} />
            </div>
            <h2 className="text-xl font-bold text-stone-900">
              Chưa có đơn hàng nào
            </h2>
            <p className="text-stone-500 text-sm mt-2 max-w-md mx-auto">
              Bạn chưa mua đồ uống nào tại BrewLite. Khám phá thực đơn và chọn món ngon ngay thôi!
            </p>
            <button
              type="button"
              onClick={() => useViewStore.getState().setCurrentView('menu')}
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-md shadow-amber-500/25 transition-all cursor-pointer border-none"
            >
              <span>Xem thực đơn</span>
              <Icon name="arrow" size={16} />
            </button>
          </div>
        )}

        {/* Danh sách đơn hàng */}
        {user && !isLoading && !error && orders.length > 0 && (
          <div className="space-y-6 my-6">
            {orders.map((order) => {
              const badge = getStatusBadge(order.status);
              const totalItemsCount = order.items.reduce(
                (sum, it) => sum + (it.qty || 1),
                0
              );
              const stepIdx = getStepIndex(order.status);
              const isPending = order.status === 'PENDING';
              const isCancelled = order.status === 'CANCELLED';
              const isCompleted = order.status === 'COMPLETED';

              return (
                <div
                  key={order.id}
                  className={`bg-white border rounded-3xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow ${
                    !isCompleted && !isCancelled
                      ? 'border-amber-300 ring-2 ring-amber-400/10'
                      : 'border-stone-200'
                  }`}
                >
                  {/* Hàng trên: Mã đơn, Thời gian & Badge */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-100">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-base sm:text-lg font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-xl border border-amber-200">
                        {order.orderCode}
                      </span>
                      <span className="text-xs text-stone-400">•</span>
                      <span className="text-xs font-semibold text-stone-500">
                        {formatDate(order.createdAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${badge.bg}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                        {badge.label}
                      </span>
                    </div>
                  </div>

                  {/* TH1: PENDING - Thông báo đơn mới tạo */}
                  {isPending && (
                    <div className="my-4 p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs font-medium text-amber-900 flex items-center gap-2">
                      <span>⏳</span>
                      <span>Đơn hàng mới tạo (PENDING), chờ thanh toán để chuyển sang quầy Barista pha chế.</span>
                    </div>
                  )}

                  {/* TH2: TIẾN TRÌNH THỜI GIAN THỰC (PAID -> PREPARING -> READY -> COMPLETED) */}
                  {stepIdx >= 0 && (
                    <div className="py-4 my-2 border-b border-stone-100">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400 mb-3 flex items-center justify-between">
                        <span>Tiến trình đơn hàng trực tiếp:</span>
                        {!isCompleted && (
                          <span className="text-amber-600 flex items-center gap-1 font-bold">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                            Đang xử lý theo thời gian thực
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {inProgressSteps.map((step, idx) => {
                          const isCurrent = stepIdx === idx;
                          const isPassed = stepIdx > idx;

                          return (
                            <div
                              key={step.key}
                              className={`p-3 rounded-2xl border text-center transition-all ${
                                isCurrent
                                  ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400/30'
                                  : isPassed
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                  : 'bg-stone-50 border-stone-200 text-stone-400 opacity-60'
                              }`}
                            >
                              <div className="text-xl mb-1">{step.icon}</div>
                              <div
                                className={`text-xs font-bold ${
                                  isCurrent
                                    ? 'text-amber-800 font-extrabold'
                                    : isPassed
                                    ? 'text-emerald-800'
                                    : 'text-stone-500'
                                }`}
                              >
                                {step.label}
                              </div>
                              <div className="text-[10px] mt-0.5">
                                {isPassed
                                  ? '✓ Đã xong'
                                  : isCurrent
                                  ? '▶ Đang diễn ra'
                                  : 'Chờ đến lượt'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Danh sách các món trong đơn */}
                  <div className="py-4 space-y-3">
                    <div className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                      Món đã chọn ({totalItemsCount} món):
                    </div>

                    <div className="space-y-2.5">
                      {order.items.map((item, itemIdx) => {
                        const toppingsList = parseToppings(item.toppings);
                        const productName =
                          item.product?.name || `Món #${item.productId}`;
                        const productImage =
                          item.product?.imageUrl ||
                          'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=300&q=80';

                        return (
                          <div
                            key={item.id || itemIdx}
                            className="flex items-center gap-3.5 p-2.5 rounded-2xl bg-stone-50/70 border border-stone-100"
                          >
                            <img
                              src={productImage}
                              alt={productName}
                              className="w-12 h-12 object-cover rounded-xl bg-stone-200 flex-shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=300&q=80';
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h4 className="font-bold text-xs sm:text-sm text-stone-900 truncate">
                                  {productName}
                                </h4>
                                <span className="font-bold text-stone-900 text-xs sm:text-sm ml-2">
                                  {formatMoney(item.lineTotal || item.price * (item.qty || 1))}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-stone-500">
                                <span className="px-1.5 py-0.5 bg-stone-200/60 rounded text-stone-700 font-semibold">
                                  Size {item.size}
                                </span>
                                <span>x{item.qty || 1}</span>
                                {toppingsList.length > 0 && (
                                  <span className="text-stone-500 truncate">
                                    • Topping: {toppingsList.join(', ')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tổng tiền đơn hàng */}
                  <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-semibold text-stone-500">
                      Tổng thanh toán ({totalItemsCount} món):
                    </span>
                    <strong className="text-base sm:text-lg font-extrabold text-amber-700">
                      {formatMoney(order.total)}
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <AuthModal />
    </div>
  );
}
