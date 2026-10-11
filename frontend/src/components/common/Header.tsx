'use client';

import React from 'react';
import Icon from './Icon';

interface HeaderProps {
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
}

export default function Header({
  onOpenNotifications,
  onOpenProfile,
}: HeaderProps) {
  return (
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
            onClick={onOpenNotifications}
          >
            <Icon name="bell" />
            <span className="notification-dot" />
          </button>
          <button
            className="avatar"
            aria-label="Your profile"
            onClick={onOpenProfile}
          >
            BL
          </button>
        </div>
      </div>
    </header>
  );
}
