'use client';

import React, { useState } from 'react';
import Icon from './Icon';

type HeaderPanel = 'notifications' | 'profile' | null;

export default function Header() {
  const [panel, setPanel] = useState<HeaderPanel>(null);

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
            <button
              className="avatar"
              aria-label="Your profile"
              onClick={() => setPanel('profile')}
            >
              BL
            </button>
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
                  : 'Hello, Guest.'}
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
                <span className="avatar large">BL</span>
                <h3>BrewLite Guest</h3>
                <p>Your next good day starts with a great coffee.</p>
                <div className="profile-status">
                  <Icon name="leaf" /> BrewLite coffee lover
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
