'use client';

import React, { useState } from 'react';
import axios from 'axios';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import { AuthResponse } from '../../types';

export default function AuthModal() {
  const isOpen = useAuthStore((state) => state.isAuthModalOpen);
  const tab = useAuthStore((state) => state.authModalTab);
  const notice = useAuthStore((state) => state.authNotice);
  const closeAuthModal = useAuthStore((state) => state.closeAuthModal);
  const setAuthModalTab = useAuthStore((state) => state.setAuthModalTab);
  const setAuth = useAuthStore((state) => state.setAuth);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setErrorMessage(null);
  };

  const handleTabChange = (nextTab: 'login' | 'register') => {
    setAuthModalTab(nextTab);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      if (tab === 'login') {
        const res = await api.post<AuthResponse>('/auth/login', {
          email: email.trim(),
          password,
        });
        setAuth(res.data.user, res.data.accessToken);
        resetForm();
      } else {
        const res = await api.post<AuthResponse>('/auth/register', {
          email: email.trim(),
          password,
          name: name.trim() || undefined,
        });
        setAuth(res.data.user, res.data.accessToken);
        resetForm();
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const msg = err.response?.data?.message;
        if (Array.isArray(msg)) {
          setErrorMessage(msg.join(', '));
        } else if (typeof msg === 'string') {
          setErrorMessage(msg);
        } else {
          setErrorMessage('Có lỗi xảy ra, vui lòng thử lại.');
        }
      } else {
        setErrorMessage('Không thể kết nối đến máy chủ.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn"
      onClick={closeAuthModal}
    >
      <div
        className="bg-[#fafaf9] text-stone-900 rounded-[32px] w-full max-w-[420px] shadow-2xl border border-stone-200/80 p-6 sm:p-7 relative animate-slideUp my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header: Logo + Close Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-100/80 border border-amber-200 flex items-center justify-center text-amber-700 shadow-sm">
              <svg
                className="w-6 h-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
                <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
                <line x1="6" y1="2" x2="6" y2="4" />
                <line x1="10" y1="2" x2="10" y2="4" />
                <line x1="14" y1="2" x2="14" y2="4" />
              </svg>
            </div>
            <span className="text-2xl font-extrabold tracking-tight text-stone-900">
              BrewLite<span className="text-amber-500">.</span>
            </span>
          </div>

          <button
            type="button"
            className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-800 flex items-center justify-center transition-colors text-base font-bold"
            aria-label="Đóng"
            onClick={closeAuthModal}
          >
            ✕
          </button>
        </div>

        {/* Tagline & Headlines */}
        <div className="mt-6">
          <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.18em] text-stone-400 uppercase block">
            A LITTLE COFFEE. A LITTLE CONNECTION.
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-stone-900 mt-1.5">
            {tab === 'login' ? 'Mừng bạn trở lại.' : 'Một khởi đầu thật thơm.'}
          </h2>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            {tab === 'login'
              ? 'Cà phê ngon hơn khi có bạn ở đây.'
              : 'Gia nhập BrewLite, thêm vui mỗi ngày.'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="bg-stone-200/60 p-1 rounded-2xl flex gap-1 mt-5">
          <button
            type="button"
            onClick={() => handleTabChange('login')}
            className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all text-center ${
              tab === 'login'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-400 hover:text-stone-700'
            }`}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('register')}
            className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all text-center ${
              tab === 'register'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-400 hover:text-stone-700'
            }`}
          >
            Đăng ký
          </button>
        </div>

        {/* Notice from Cart or system */}
        {notice && (
          <div className="mt-3.5 p-3 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-2">
            <span>☕</span>
            <span>{notice}</span>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="mt-3.5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
          {tab === 'register' && (
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5 ml-1">
                Họ và tên
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-4 text-stone-400">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tên của bạn"
                  className="w-full bg-white rounded-full border border-stone-200 py-3 pl-11 pr-4 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5 ml-1">
              Email
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-stone-400">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ban@email.com"
                className="w-full bg-white rounded-full border border-stone-200 py-3 pl-11 pr-4 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5 ml-1">
              Mật khẩu
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-stone-400">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  tab === 'login' ? 'Nhập mật khẩu của bạn' : 'Ít nhất 6 ký tự'
                }
                className="w-full bg-white rounded-full border border-stone-200 py-3 pl-11 pr-11 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 text-stone-400 hover:text-stone-600 focus:outline-none"
                aria-label="Hiện mật khẩu"
              >
                {showPassword ? (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {tab === 'login' && (
            <div className="flex justify-end pr-1">
              <button
                type="button"
                onClick={() => alert('Vui lòng liên hệ quản trị viên để khôi phục mật khẩu.')}
                className="text-xs text-stone-500 hover:text-amber-700 transition-colors"
              >
                Quên mật khẩu?
              </button>
            </div>
          )}

          {/* Action CTA Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-4 py-3.5 px-6 rounded-full bg-[#f08c00] hover:bg-[#e07c00] active:scale-[0.99] text-white font-bold text-sm sm:text-base shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {isLoading ? (
              <span>Đang xử lý...</span>
            ) : (
              <>
                <span>
                  {tab === 'login' ? 'Đăng nhập ngay' : 'Tạo tài khoản'}
                </span>
                <span className="text-lg">→</span>
              </>
            )}
          </button>
        </form>

        {/* Switch tab link */}
        <div className="text-center text-xs text-stone-600 mt-5">
          {tab === 'login' ? (
            <>
              Bạn mới ghé BrewLite?{' '}
              <button
                type="button"
                onClick={() => handleTabChange('register')}
                className="font-bold text-amber-700 hover:underline cursor-pointer"
              >
                Đăng ký ngay
              </button>
            </>
          ) : (
            <>
              Đã là người nhà BrewLite?{' '}
              <button
                type="button"
                onClick={() => handleTabChange('login')}
                className="font-bold text-amber-700 hover:underline cursor-pointer"
              >
                Đăng nhập
              </button>
            </>
          )}
        </div>

        {/* Bottom subtle divider */}
        <div className="flex items-center gap-3 mt-6">
          <div className="flex-1 h-px bg-stone-200" />
          <span className="text-[9px] uppercase tracking-widest text-stone-400 font-semibold whitespace-nowrap">
            BREWED WITH LOVE, SHARED WITH YOU
          </span>
          <div className="flex-1 h-px bg-stone-200" />
        </div>
      </div>
    </div>
  );
}
