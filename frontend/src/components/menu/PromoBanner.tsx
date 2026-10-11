import React from 'react';
import Icon from '../common/Icon';

export default function PromoBanner() {
  return (
    <>
      <div className="greeting">
        <span>YOUR DAILY DOSE OF HAPPY</span>
        <span className="open">
          <i />
          We&apos;re brewing
        </span>
      </div>

      <section className="promotion">
        <div className="promotion-content">
          <div className="eyebrow">
            <span /> MADE WITH LOVE, EVERY DAY
          </div>
          <h1>
            Good days start
            <br />
            with <em>great coffee.</em>
          </h1>
          <p>Crafted Coffee, Fresh Everyday.</p>
          <div className="promo-footer">
            <span className="bean-mark">
              <Icon name="leaf" size={14} />
            </span>{' '}
            Fresh beans. Better moments.
          </div>
        </div>
        <div className="promo-photo">
          <img
            src="https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=650&q=85"
            alt="Fresh iced coffee in a glass"
          />
          <span className="photo-sticker">
            A little sip
            <br />
            <strong>of happiness.</strong>
          </span>
        </div>
      </section>
    </>
  );
}
