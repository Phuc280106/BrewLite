'use client';

import React, { useState } from 'react';
import Icon from './Icon';
import { useAuthStore } from '../../store/useAuthStore';

type HeaderPanel = 'notifications' | 'profile' | null;

export default function Header() {
  const [panel, setPanel] = useState<HeaderPanel>(null);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);

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

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <a className="brand" href="#" aria-label="BrewLite home">
            <span className="brand-icon">
              <Icon name="cup" size={23} />
            </span>
            BrewLite<span className="brand-dot">.</span>
          </a>
          <span className="header-note">GOOD COFFEE. GOOD DAYS.</span>
          <div className="header-actions">
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
                  className="avatar cursor-pointer hover:ring-2 hover:ring-amber-500/50 transition-all"
                  aria-label="Tài khoản của bạn"
                  onClick={() => setPanel('profile')}
                  title={user.name || user.email}
                >
                  {getInitials(user.name, user.email)}
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
                <span className="avatar large">
                  {getInitials(user?.name, user?.email)}
                </span>
                <h3>{user?.name || 'Thành viên BrewLite'}</h3>
                <p className="text-stone-500 text-xs mt-0.5">{user?.email}</p>
                <div className="profile-status mt-3">
                  <Icon name="leaf" /> Thành viên thân thiết (
                  {user?.loyaltyPoints ?? 0} điểm)
                </div>

                {user ? (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full mt-5 py-2.5 px-4 rounded-2xl bg-stone-100 hover:bg-rose-50 hover:text-rose-600 font-bold text-xs sm:text-sm text-stone-700 transition-colors border border-stone-200 cursor-pointer"
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
                    className="w-full mt-5 py-2.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
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
