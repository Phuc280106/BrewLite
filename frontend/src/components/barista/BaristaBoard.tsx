'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useViewStore } from '@/store/useViewStore';
import axios from 'axios';
import Header from '../common/Header';
import Icon from '../common/Icon';
import AuthModal from '../auth/AuthModal';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/api';
import { OrderDetail, OrderStatus } from '@/types';

type FilterTab = 'ALL' | 'PAID' | 'PREPARING' | 'READY' | 'COMPLETED';

export default function BaristaBoard() {
  const user = useAuthStore((state) => state.user);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);

  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filter, setFilter] = useState<FilterTab>('ALL');
  const [searchCode, setSearchCode] = useState('');

  const isBarista =
    user?.role === 'BARISTA' ||
    user?.email?.toLowerCase().includes('barista') ||
    user?.name?.toLowerCase().includes('barista');

  const fetchOrders = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      // Gọi GET /orders để lấy toàn bộ đơn hàng của cửa hàng cho Barista
      const res = await api.get<OrderDetail[]>('/orders');
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (err: unknown) {
      console.error('Barista board fetch error:', err);
      // Fallback nếu cần
      try {
        const fallbackRes = await api.get<OrderDetail[]>('/orders/me');
        setOrders(Array.isArray(fallbackRes.data) ? fallbackRes.data : []);
      } catch {
        // Silent error
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isBarista) {
      fetchOrders();
      // Auto-refresh mỗi 10 giây cho Barista KDS
      const interval = setInterval(() => {
        fetchOrders(true);
      }, 10000);
      return () => clearInterval(interval);
    } else {
      setIsLoading(false);
    }
  }, [isBarista, fetchOrders]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Barista chuyển trạng thái qua PATCH /orders/:id/status
  // Tuân thủ: Barista chỉ thao tác từ PAID -> PREPARING -> READY -> COMPLETED
  const handleUpdateStatus = async (orderId: number, nextStatus: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      const response = await api.patch<OrderDetail>(`/orders/${orderId}/status`, {
        status: nextStatus,
      });

      const updated = response.data;

      // Cập nhật state danh sách đơn
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, ...updated, status: nextStatus } : o))
      );

      showToast(
        `Đơn hàng #${orderId} (${updated.orderCode || `BL-${orderId}`}) đã chuyển sang: ${nextStatus}!`,
        'success'
      );
    } catch (err: unknown) {
      let msg = 'Không thể cập nhật trạng thái đơn hàng.';
      if (axios.isAxiosError(err)) {
        msg = err.response?.data?.message || msg;
      }
      showToast(Array.isArray(msg) ? msg.join(', ') : msg, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const formatMoney = (val: number) => `${val.toLocaleString('vi-VN')} ₫`;

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
      }).format(date);
    } catch {
      return dateStr;
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

  const getStatusBadge = (status: OrderStatus | string) => {
    switch (status) {
      case 'PENDING':
        return {
          label: 'Chờ khách thanh toán',
          bg: 'bg-amber-100 text-amber-900 border-amber-300',
        };
      case 'PAID':
        return {
          label: 'Đã thanh toán (Chờ pha)',
          bg: 'bg-sky-100 text-sky-900 border-sky-300 font-bold',
        };
      case 'PREPARING':
        return {
          label: 'Đang pha chế',
          bg: 'bg-orange-100 text-orange-900 border-orange-300 font-bold',
        };
      case 'READY':
        return {
          label: 'Sẵn sàng lấy món',
          bg: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold',
        };
      case 'COMPLETED':
        return {
          label: 'Đã hoàn tất',
          bg: 'bg-stone-100 text-stone-700 border-stone-300',
        };
      case 'CANCELLED':
        return {
          label: 'Đã hủy',
          bg: 'bg-rose-100 text-rose-800 border-rose-300',
        };
      default:
        return {
          label: status,
          bg: 'bg-stone-100 text-stone-800 border-stone-300',
        };
    }
  };

  // Lọc theo tabs & tìm kiếm
  const filteredOrders = orders.filter((o) => {
    if (searchCode.trim()) {
      const q = searchCode.toLowerCase();
      const matchCode = o.orderCode?.toLowerCase().includes(q);
      const matchId = String(o.id).includes(q);
      if (!matchCode && !matchId) return false;
    }

    if (filter === 'ALL') return true;
    return o.status === filter;
  });

  const countByStatus = (status: OrderStatus) =>
    orders.filter((o) => o.status === status).length;

  return (
    <div className="app min-h-screen flex flex-col bg-stone-100">
      <Header />

      {/* Thông báo nổi Toast */}
      {feedbackMsg && (
        <div
          role="alert"
          className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl border text-sm font-bold flex items-center gap-2.5 transition-all animate-fadeIn ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-900 text-emerald-100 border-emerald-700'
              : 'bg-rose-900 text-rose-100 border-rose-700'
          }`}
        >
          <span>{feedbackMsg.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Kiểm tra phân quyền: Chưa đăng nhập */}
        {!user && !isLoading && (
          <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-stone-200 shadow-md my-8 max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4 border border-amber-200">
              <span className="text-3xl">🔒</span>
            </div>
            <h2 className="text-2xl font-black text-stone-900">
              Yêu cầu quyền Barista
            </h2>
            <p className="text-stone-600 text-sm mt-2">
              Màn hình KDS tiếp nhận và pha chế đơn hàng chỉ dành cho nhân viên Barista của BrewLite. Vui lòng đăng nhập với tài khoản nhân viên.
            </p>
            <div className="mt-4 p-3 rounded-2xl bg-stone-50 border border-stone-200 text-xs text-stone-600">
              💡 <strong>Tài khoản Barista mẫu:</strong> <code>barista@brewlite.vn</code> · Mật khẩu: <code>barista123</code>
            </div>
            <button
              onClick={() => openAuthModal('login')}
              className="mt-6 w-full py-3 px-6 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
            >
              Đăng nhập tài khoản Barista
            </button>
          </div>
        )}

        {/* Kiểm tra phân quyền: Đã đăng nhập nhưng là CUSTOMER */}
        {user && !isBarista && !isLoading && (
          <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-rose-200 shadow-md my-8 max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto mb-4 border border-rose-200">
              <span className="text-3xl">🚫</span>
            </div>
            <h2 className="text-2xl font-black text-stone-900">
              Quyền truy cập bị từ chối (403)
            </h2>
            <p className="text-stone-600 text-sm mt-2">
              Tài khoản hiện tại của bạn là <strong>Khách hàng ({user.email})</strong>. Màn hình này được bảo vệ và chỉ dành riêng cho <strong>Nhân viên Barista</strong> quầy pha chế.
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => useViewStore.getState().setCurrentView('orders')}
                className="py-3 px-6 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-md transition-all text-center cursor-pointer border-none"
              >
                Xem Lịch sử đơn hàng của bạn
              </button>
              <button
                onClick={() => openAuthModal('login', 'Vui lòng đăng nhập bằng tài khoản Barista')}
                className="py-2.5 px-4 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs transition-colors cursor-pointer"
              >
                Đăng nhập tài khoản khác
              </button>
            </div>
          </div>
        )}

        {/* Giao diện KDS cho Nhân viên Barista */}
        {user && isBarista && (
          <>
            {/* Banner Barista KDS */}
            <div className="bg-stone-900 text-white rounded-3xl p-6 sm:p-8 mb-6 shadow-md border border-stone-800">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30 mb-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    Kitchen Display System · Nhân viên Barista: {user.name || user.email}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    Màn hình pha chế Barista
                  </h1>
                  <p className="text-stone-400 text-xs sm:text-sm mt-1">
                    Tiếp nhận đơn hàng đã thanh toán và cập nhật tiến trình: PAID → PREPARING → READY → COMPLETED
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fetchOrders(true)}
                    disabled={isRefreshing}
                    className="group px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-white rounded-full text-xs font-semibold border border-stone-700 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-xs hover:shadow-sm"
                  >
                    <svg
                      className={`w-3.5 h-3.5 text-stone-400 group-hover:text-amber-400 transition-transform duration-500 ${
                        isRefreshing ? 'animate-spin text-amber-400' : 'group-hover:rotate-180'
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
                    <span>{isRefreshing ? 'Đang tải...' : 'Làm mới'}</span>
                  </button>
                </div>
              </div>

              {/* Quick Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-stone-800 text-center">
                <div className="bg-stone-800/60 p-3 rounded-2xl border border-stone-700/60">
                  <span className="text-xs font-semibold text-stone-400">1. Chờ pha (Đã thanh toán)</span>
                  <div className="text-2xl font-black text-sky-400 mt-0.5">
                    {countByStatus('PAID')}
                  </div>
                </div>
                <div className="bg-stone-800/60 p-3 rounded-2xl border border-stone-700/60">
                  <span className="text-xs font-semibold text-stone-400">2. Đang pha chế</span>
                  <div className="text-2xl font-black text-orange-400 mt-0.5">
                    {countByStatus('PREPARING')}
                  </div>
                </div>
                <div className="bg-stone-800/60 p-3 rounded-2xl border border-stone-700/60">
                  <span className="text-xs font-semibold text-stone-400">3. Sẵn sàng nhận món</span>
                  <div className="text-2xl font-black text-emerald-400 mt-0.5">
                    {countByStatus('READY')}
                  </div>
                </div>
                <div className="bg-stone-800/60 p-3 rounded-2xl border border-stone-700/60">
                  <span className="text-xs font-semibold text-stone-400">4. Đã hoàn tất</span>
                  <div className="text-2xl font-black text-stone-300 mt-0.5">
                    {countByStatus('COMPLETED')}
                  </div>
                </div>
              </div>
            </div>

            {/* Thanh công cụ: Tra cứu & Bộ lọc */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-sm mb-6 space-y-4">
              <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
                {/* Tabs Filter */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs font-bold">
                  {[
                    { id: 'ALL', label: 'Tất cả' },
                    { id: 'PAID', label: 'Chờ pha (PAID)' },
                    { id: 'PREPARING', label: 'Đang pha chế (PREPARING)' },
                    { id: 'READY', label: 'Sẵn sàng (READY)' },
                    { id: 'COMPLETED', label: 'Đã hoàn tất (COMPLETED)' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setFilter(tab.id as FilterTab)}
                      className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                        filter === tab.id
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tìm kiếm mã đơn */}
                <div className="relative min-w-[240px]">
                  <input
                    type="text"
                    placeholder="Lọc theo mã đơn (BL-000001)..."
                    value={searchCode}
                    onChange={(e) => setSearchCode(e.target.value)}
                    className="w-full text-xs font-medium px-3.5 py-2 rounded-xl bg-stone-50 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                  {searchCode && (
                    <button
                      onClick={() => setSearchCode('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Loading skeleton */}
            {isLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-white rounded-3xl p-5 border border-stone-200 space-y-4 animate-pulse"
                  >
                    <div className="h-6 bg-stone-200 rounded-lg w-32" />
                    <div className="h-16 bg-stone-100 rounded-xl" />
                    <div className="h-10 bg-stone-200 rounded-xl" />
                  </div>
                ))}
              </div>
            )}

            {/* Trống đơn */}
            {!isLoading && filteredOrders.length === 0 && (
              <div className="bg-white rounded-3xl p-10 text-center border border-stone-200 shadow-sm my-6">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
                  <Icon name="cup" size={32} />
                </div>
                <h3 className="text-lg font-bold text-stone-900">
                  Không có đơn hàng nào ở mục này
                </h3>
                <p className="text-stone-500 text-xs sm:text-sm mt-1 max-w-sm mx-auto">
                  Khi khách hàng đặt và thanh toán đơn hàng trực tuyến, đơn sẽ tự động hiển thị ở trạng thái PAID tại đây để Barista pha chế.
                </p>
              </div>
            )}

            {/* Lưới đơn hàng Barista KDS */}
            {!isLoading && filteredOrders.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredOrders.map((order) => {
                  const badge = getStatusBadge(order.status);
                  const isUpdating = updatingId === order.id;
                  const totalItems = order.items.reduce((s, it) => s + (it.qty || 1), 0);

                  return (
                    <div
                      key={order.id}
                      className={`bg-white rounded-3xl p-5 border shadow-sm flex flex-col justify-between transition-all duration-200 ${
                        order.status === 'PREPARING'
                          ? 'border-orange-300 ring-2 ring-orange-400/20'
                          : order.status === 'READY'
                          ? 'border-emerald-300 ring-2 ring-emerald-400/20'
                          : order.status === 'PAID'
                          ? 'border-sky-300 ring-2 ring-sky-400/20'
                          : 'border-stone-200'
                      }`}
                    >
                      <div>
                        {/* Header đơn */}
                        <div className="flex items-center justify-between gap-2 pb-3 border-b border-stone-100">
                          <div>
                            <span className="font-mono text-base font-extrabold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200">
                              {order.orderCode || `BL-${order.id}`}
                            </span>
                            <span className="text-[11px] text-stone-400 block mt-1">
                              {formatDate(order.createdAt)}
                            </span>
                          </div>

                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-full border ${badge.bg}`}
                          >
                            {badge.label}
                          </span>
                        </div>

                        {/* Danh sách món cần pha chế */}
                        <div className="py-3 space-y-2">
                          <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                            Món cần pha ({totalItems} món):
                          </div>

                          {order.items.length === 0 ? (
                            <p className="text-xs text-stone-400 italic">
                              (Chi tiết món chưa có sẵn hoặc đơn mẫu)
                            </p>
                          ) : (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              {order.items.map((item, idx) => {
                                const toppingsList = parseToppings(item.toppings);
                                const name = item.product?.name || `Món #${item.productId}`;

                                return (
                                  <div
                                    key={item.id || idx}
                                    className="p-2 rounded-xl bg-stone-50 border border-stone-100 text-xs"
                                  >
                                    <div className="flex items-center justify-between font-bold text-stone-900">
                                      <span>{name}</span>
                                      <span className="text-amber-700">x{item.qty || 1}</span>
                                    </div>
                                    <div className="text-[11px] text-stone-500 mt-0.5">
                                      Size: <span className="font-semibold text-stone-700">{item.size}</span>
                                      {toppingsList.length > 0 && (
                                        <span className="ml-1 text-stone-600">
                                          • Topping: {toppingsList.join(', ')}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Vùng thao tác chuyển trạng thái (State Machine Action Buttons) */}
                      <div className="pt-4 border-t border-stone-100 space-y-2">
                        <div className="flex items-center justify-between text-xs text-stone-500 pb-1">
                          <span>Tổng giá trị đơn:</span>
                          <strong className="text-stone-900 font-bold">
                            {formatMoney(order.total)}
                          </strong>
                        </div>

                        {/* PENDING: Đơn chờ khách thanh toán -> Nhân viên KHÔNG chuyển sang PAID bằng tay */}
                        {order.status === 'PENDING' && (
                          <div className="py-2.5 px-3 rounded-2xl bg-amber-50 border border-amber-200 text-center text-xs font-semibold text-amber-800">
                            ⏳ Đơn đang chờ khách hàng thanh toán trực tuyến
                          </div>
                        )}

                        {/* PAID: Đã thanh toán -> Nút bấm bắt đầu pha chế PREPARING */}
                        {order.status === 'PAID' && (
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'PREPARING')}
                            disabled={isUpdating}
                            className="w-full py-2.5 px-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-98"
                          >
                            <span>☕</span>
                            <span>{isUpdating ? 'Đang cập nhật...' : 'Bắt đầu pha chế (→ PREPARING)'}</span>
                          </button>
                        )}

                        {/* PREPARING: Đang pha -> Nút bấm hoàn thành READY */}
                        {order.status === 'PREPARING' && (
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'READY')}
                            disabled={isUpdating}
                            className="w-full py-2.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-98"
                          >
                            <span>🔔</span>
                            <span>{isUpdating ? 'Đang cập nhật...' : 'Pha xong - Sẵn sàng (→ READY)'}</span>
                          </button>
                        )}

                        {/* READY: Đã sẵn sàng -> Nút bấm giao khách COMPLETED */}
                        {order.status === 'READY' && (
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'COMPLETED')}
                            disabled={isUpdating}
                            className="w-full py-2.5 px-3 rounded-2xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-98"
                          >
                            <span>✓</span>
                            <span>{isUpdating ? 'Đang cập nhật...' : 'Giao khách thành công (→ COMPLETED)'}</span>
                          </button>
                        )}

                        {/* COMPLETED: Đã hoàn tất */}
                        {order.status === 'COMPLETED' && (
                          <div className="py-2 text-center text-xs font-bold text-stone-500 bg-stone-100 rounded-xl">
                            ✓ Đơn hàng đã hoàn tất
                          </div>
                        )}

                        {/* CANCELLED: Đã hủy */}
                        {order.status === 'CANCELLED' && (
                          <div className="py-2 text-center text-xs font-bold text-rose-600 bg-rose-50 rounded-xl border border-rose-200">
                            ✕ Đơn hàng đã bị hủy
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      <AuthModal />
    </div>
  );
}
