'use client';

import React, { useState } from 'react';
import Icon from './Icon';
import { useAuthStore } from '../../store/useAuthStore';
import { useViewStore } from '../../store/useViewStore';

type HeaderPanel = 'notifications' | 'profile' | null;

export default function Header() {
  const [panel, setPanel] = useState<HeaderPanel>(null);
  const currentView = useViewStore((state) => state.currentView);
  const setCurrentView = useViewStore((state) => state.setCurrentView);

  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);

  const isBarista =
    user?.role === 'BARISTA' ||
    user?.email?.toLowerCase().includes('barista') ||
    user?.name?.toLowerCase().includes('barista');

  const getInitials = (name?: string | null, email?: string) => {
    if (name?.trim()) {
      const parts = name.trim().split(' ');
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return email ? email.slice(0, 2).toUpperCase() : 'BL';
  };

  const handleLogout = () => {
    logout();
    setPanel(null);
  };

  const navItems = [
    { label: 'Thực đơn', view: 'menu' as const },
    { label: 'Lịch sử đơn', view: 'orders' as const },
    ...(isBarista ? [{ label: '☕ Kênh Barista', view: 'barista' as const }] : []),
  ];

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <div className="flex items-center gap-6">
            <button
              type="button"
              className="brand text-left cursor-pointer border-none bg-transparent p-0"
              onClick={() => setCurrentView('menu')}
              aria-label="BrewLite home"
            >
              <span className="brand-icon">
                <Icon name="cup" size={23} />
              </span>
              BrewLite<span className="brand-dot">.</span>
            </button>

            <nav className="hidden md:flex items-center gap-1 bg-stone-100/80 p-1 rounded-full border border-stone-200/60 text-xs font-semibold">
              {navItems.map((item) => {
                const isActive = currentView === item.view;
                return (
                  <button
                    key={item.view}
                    type="button"
                    onClick={() => setCurrentView(item.view)}
                    className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer border-none ${
                      isActive
                        ? 'bg-white text-stone-900 shadow-sm font-bold'
                        : 'bg-transparent text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <span className="header-note hidden lg:inline-block">GOOD COFFEE. GOOD DAYS.</span>

          <div className="header-actions">
            {/* Quick links on mobile */}
            <div className="flex md:hidden items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setCurrentView('orders')}
                className={`px-2.5 py-1.5 rounded-lg font-medium cursor-pointer border-none ${
                  currentView === 'orders'
                    ? 'bg-amber-100 text-amber-900 font-bold'
                    : 'bg-transparent text-stone-600'
                }`}
              >
                Đơn hàng
              </button>
              {isBarista && (
                <button
                  type="button"
                  onClick={() => setCurrentView('barista')}
                  className={`px-2.5 py-1.5 rounded-lg font-medium cursor-pointer border-none ${
                    currentView === 'barista'
                      ? 'bg-amber-100 text-amber-900 font-bold'
                      : 'bg-transparent text-stone-600'
                  }`}
                >
                  Barista
                </button>
              )}
            </div>

            <button
              className="icon-button notification"
              aria-label="Notifications"
              onClick={() => setPanel('notifications')}
            >
              <Icon name="bell" />
              <span className="notification-dot" />
            </button>

            {user ? (
              <div className="flex items-center gap-2">
                <button
                  className="avatar cursor-pointer hover:ring-2 hover:ring-amber-500/50 transition-all relative"
                  aria-label="Tài khoản của bạn"
                  onClick={() => setPanel('profile')}
                  title={user.name || user.email}
                >
                  {getInitials(user.name, user.email)}
                  {isBarista && (
                    <span
                      title="Nhân viên Barista"
                      className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-amber-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold ring-2 ring-white"
                    >
                      B
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="hidden sm:inline-flex py-1.5 px-3 rounded-full text-xs font-semibold text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  Đăng xuất
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="py-2 px-4 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm shadow-md shadow-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>Đăng nhập</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {panel && (
        <div className="modal-backdrop" onClick={() => setPanel(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={panel}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <h2>
                {panel === 'notifications'
                  ? 'Fresh from BrewLite'
                  : user
                  ? `Xin chào, ${user.name || user.email.split('@')[0]}!`
                  : 'Xin chào, quý khách!'}
              </h2>
              <button
                className="icon-button"
                aria-label="Close dialog"
                onClick={() => setPanel(null)}
              >
                <Icon name="close" />
              </button>
            </div>

            {panel === 'notifications' ? (
              <div className="notification-content">
                <span className="empty-icon">
                  <Icon name="cup" size={32} />
                </span>
                <h3>Freshly brewed, just for you.</h3>
                <p>
                  Thực đơn hôm nay đã sẵn sàng. Hãy thưởng thức ly cà phê tuyệt
                  hảo của bạn!
                </p>
                <span className="notification-time">Today · BrewLite</span>
              </div>
            ) : (
              <div className="profile-content">
                <span className="avatar large relative">
                  {getInitials(user?.name, user?.email)}
                </span>
                <div className="flex items-center gap-2 mt-2">
                  <h3 className="font-bold text-stone-900">{user?.name || 'Thành viên BrewLite'}</h3>
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      isBarista
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-stone-100 text-stone-600 border border-stone-200'
                    }`}
                  >
                    {isBarista ? '☕ Barista' : 'Khách hàng'}
                  </span>
                </div>
                <p className="text-stone-500 text-xs mt-0.5">{user?.email}</p>

                <div className="profile-status mt-3">
                  <Icon name="leaf" /> Thành viên thân thiết (
                  {user?.loyaltyPoints ?? 0} điểm)
                </div>

                <div className="w-full mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPanel(null);
                      setCurrentView('orders');
                    }}
                    className="w-full py-2.5 px-4 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs sm:text-sm transition-colors border border-amber-200 flex items-center justify-between cursor-pointer"
                  >
                    <span>Lịch sử đơn hàng của tôi</span>
                    <Icon name="arrow" size={16} />
                  </button>

                  {isBarista && (
                    <button
                      type="button"
                      onClick={() => {
                        setPanel(null);
                        setCurrentView('barista');
                      }}
                      className="w-full py-2.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm transition-colors flex items-center justify-between shadow-sm cursor-pointer"
                    >
                      <span>☕ Vào kênh làm việc Barista</span>
                      <Icon name="arrow" size={16} />
                    </button>
                  )}
                </div>

                {user ? (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full mt-4 py-2.5 px-4 rounded-2xl bg-stone-100 hover:bg-rose-50 hover:text-rose-600 font-bold text-xs sm:text-sm text-stone-700 transition-colors border border-stone-200 cursor-pointer"
                  >
                    Đăng xuất khỏi tài khoản
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setPanel(null);
                      openAuthModal('login');
                    }}
                    className="w-full mt-4 py-2.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
                  >
                    Đăng nhập ngay
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
