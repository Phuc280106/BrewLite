'use client';

import React, { useState, useEffect } from "react";
import axios from "axios";

type IconName = "cup" | "bell" | "bag" | "plus" | "arrow" | "close" | "check" | "leaf";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    cup: (
      <>
        <path d="M5 8h12v7a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8Z" />
        <path d="M17 9h2a3 3 0 0 1 0 6h-2M8 3v2m4-2v2m4-2v2M3 22h16" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    bag: (
      <>
        <path d="M5 7h14l1 14H4L5 7Z" />
        <path d="M9 9V6a3 3 0 0 1 6 0v3" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    leaf: (
      <>
        <path d="M20 3C9 2 3 9 7 16c7 4 14-2 13-13Z" />
        <path d="M4 21 15 10" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

const imageFallback = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=650&q=85`;

// Dữ liệu mẫu dự phòng ban đầu
const initialProducts = [
  {
    id: 1,
    name: "Cà phê sữa đá",
    note: "Đậm đà hương vị truyền thống",
    price: 25000,
    stock: 100,
    category: "Coffee",
    tag: "Best Seller",
    image: imageFallback("photo-1517701550927-30cf4ba1dba5"),
  },
  {
    id: 2,
    name: "Americano Đá",
    note: "Thanh nhẹ, sảng khoái ngày mới",
    price: 30000,
    stock: 50,
    category: "Coffee",
    tag: "In Stock",
    image: imageFallback("photo-1551030173-122aabc4489c"),
  },
  {
    id: 3,
    name: "Bạc xỉu",
    note: "Ngọt ngào sữa đặc béo thơm",
    price: 29000,
    stock: 80,
    category: "Coffee",
    tag: "In Stock",
    image: imageFallback("photo-1572442388796-11668a67e53d"),
  },
  {
    id: 4,
    name: "Trà đào cam sả",
    note: "Tươi mát, thơm lừng vị đào sả",
    price: 40000,
    stock: 60,
    category: "Tea & Fruit",
    tag: "Popular",
    image: imageFallback("photo-1621269062970-d7d8e6db98ee"),
  },
  {
    id: 5,
    name: "Matcha đá xay",
    note: "Matcha Nhật béo mịn mát lạnh",
    price: 45000,
    stock: 40,
    category: "Blended Ice",
    tag: "Popular",
    image: imageFallback("photo-1570696587429-19ec024c6e6e"),
  },
  {
    id: 6,
    name: "Cappuccino Nóng",
    note: "Bọt sữa mịn màng chuẩn Ý",
    price: 35000,
    stock: 30,
    category: "Coffee",
    tag: "In Stock",
    image: imageFallback("photo-1534687941688-6c9fa1265842"),
  },
];

const categories = [
  "All Drinks",
  "Coffee",
  "Tea & Fruit",
  "Blended Ice",
  "Pastries",
];

const money = (value: number) => `${value.toLocaleString("vi-VN")} ₫`;

export default function App() {
  const [productsList, setProductsList] = useState(initialProducts);
  const [category, setCategory] = useState("All Drinks");
  const [cart, setCart] = useState<Record<number, number>>({});
  const [panel, setPanel] = useState<"cart" | "notifications" | "profile" | null>(null);
  const [state, setState] = useState("Loading");
  const [ordered, setOrdered] = useState(false);

  // Gọi API từ NestJS Backend (Task 3 Requirement)
  useEffect(() => {
    async function fetchProducts() {
      try {
        setState("Loading");
        const backendHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
        const res = await axios.get(`http://${backendHost}:3001/products`);
        if (res.data && res.data.length > 0) {
          console.log("🟢 [BrewLite FE] Đã lấy thành công", res.data.length, "sản phẩm từ Backend NestJS (PostgreSQL):", res.data);
          const mapped = res.data.map((p: any) => {
            return {
              id: p.id,
              name: p.name,
              note: p.description || "Hương vị đồ uống tươi mới mỗi ngày",
              price: p.price,
              stock: p.stock,
              category: p.category || (p.name.toLowerCase().includes("trà") ? "Tea & Fruit" : "Coffee"),
              tag: p.id === 13 || p.id === 1 ? "Best Seller" : "In Stock",
              image: p.imageUrl || imageFallback("photo-1517701550927-30cf4ba1dba5"),
            };
          });
          setProductsList(mapped);
          setState("Menu");
        } else {
          setState("Empty");
        }
      } catch (err) {
        console.warn("Backend chưa chạy hoặc có lỗi, dùng dữ liệu mẫu cục bộ:", err);
        setProductsList(initialProducts);
        setState("Menu");
      }
    }

    fetchProducts();
  }, []);

  const filtered = productsList.filter(
    (p) => category === "All Drinks" || p.category === category,
  );

  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const total = productsList.reduce(
    (sum, p) => sum + p.price * (cart[p.id] || 0),
    0,
  );

  function add(id: number, amount = 1) {
    setOrdered(false);
    setCart((previous) => {
      const prod = productsList.find((p) => p.id === id);
      if (!prod) return previous;
      const current = previous[id] || 0;
      const next = Math.max(0, Math.min(prod.stock, current + amount));
      return {
        ...previous,
        [id]: next,
      };
    });
  }

  return (
    <div className="app">
      {/* 1. Header */}
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
              onClick={() => setPanel("notifications")}
            >
              <Icon name="bell" />
              <span className="notification-dot" />
            </button>
            <button
              className="avatar"
              aria-label="Your profile"
              onClick={() => setPanel("profile")}
            >
              BL
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Content */}
      <main className="main">
        <div className="greeting">
          <span>YOUR DAILY DOSE OF HAPPY</span>
          <span className="open">
            <i />
            We&apos;re brewing
          </span>
        </div>

        {/* Hero Promotion Banner */}
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
              </span>{" "}
              Fresh beans. Better moments.
            </div>
          </div>
          <div className="promo-photo">
            <img
              src={imageFallback("photo-1517701550927-30cf4ba1dba5")}
              alt="Fresh iced coffee in a glass"
            />
            <span className="photo-sticker">
              A little sip
              <br />
              <strong>of happiness.</strong>
            </span>
          </div>
        </section>

        {/* Menu Section */}
        <section className="menu-section">
          <div className="menu-heading">
            <div>
              <h2>
                Find your favorite<span>.</span>
              </h2>
              <p>A little something for every kind of day.</p>
            </div>
            <span className="handwritten">
              Made for you <span>↙</span>
            </span>
          </div>

          {/* Categories Filter Tabs */}
          <div className="categories" aria-label="Menu categories">
            {categories.map((c, i) => (
              <button
                key={c}
                className={`category ${category === c ? "active" : ""}`}
                onClick={() => setCategory(c)}
              >
                {i === 0 && <Icon name="cup" size={17} />} {c}
              </button>
            ))}
          </div>

          {/* Section Title & State Control */}
          <div className="section-title">
            <div>
              <h3>Our menu</h3>
              <span className="item-count">
                {state === "Empty" ? 0 : filtered.length} items available
              </span>
            </div>
            <label className="state-control">
              <span className="sr-only">Preview menu state</span>
              <select
                aria-label="Preview menu state"
                value={state}
                onChange={(e) => setState(e.target.value)}
              >
                <option value="Menu">Menu (Default)</option>
                <option value="Loading">Loading State</option>
                <option value="Empty">Empty State</option>
              </select>
            </label>
          </div>

          {/* A. LOADING STATE (Skeletons) */}
          {state === "Loading" ? (
            <div
              className="product-grid"
              aria-label="Loading menu"
              aria-busy="true"
            >
              {[0, 1, 2, 3].map((i) => (
                <div className="product-card skeleton" key={i}>
                  <div className="skeleton-image" />
                  <div className="skeleton-line" />
                  <div className="skeleton-line short" />
                  <div className="skeleton-line" />
                </div>
              ))}
            </div>
          ) : state === "Empty" ? (
            /* B. EMPTY STATE */
            <div className="empty-state">
              <span className="empty-icon">
                <Icon name="cup" size={44} />
              </span>
              <h3>No items found in menu</h3>
              <p>Something delicious will be here soon.</p>
              <button
                className="primary-button"
                onClick={() => {
                  setState("Menu");
                  setCategory("All Drinks");
                }}
              >
                Explore all drinks <Icon name="arrow" size={17} />
              </button>
            </div>
          ) : (
            /* C. SUCCESS MENU GRID */
            <div className="product-grid">
              {filtered.map((p) => (
                <article className="product-card" key={p.id}>
                  <div className="product-image">
                    <img
                      src={p.image}
                      alt={p.name}
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          imageFallback("photo-1517701550927-30cf4ba1dba5");
                      }}
                    />
                    <span
                      className={`product-tag ${
                        p.tag === "Best Seller" || p.tag === "Popular"
                          ? "bestseller"
                          : ""
                      }`}
                    >
                      {p.tag === "In Stock" && <i />}
                      {p.tag}
                    </span>
                    {(cart[p.id] || 0) > 0 && (
                      <span className="quantity-badge">
                        {cart[p.id]} in bag
                      </span>
                    )}
                  </div>
                  <div className="product-details">
                    <h4>{p.name}</h4>
                    <p className="product-note">{p.note}</p>
                    <p className="stock">
                      <span />
                      {p.stock - (cart[p.id] || 0)}{" "}
                      {p.category === "Pastries" ? "pieces" : "cups"} left
                    </p>
                    <div className="product-bottom">
                      <strong>{money(p.price)}</strong>
                      <button
                        className="add-button"
                        onClick={() => add(p.id)}
                        disabled={cart[p.id] >= p.stock}
                        aria-label={`Add ${p.name} to cart`}
                      >
                        <Icon name="plus" size={19} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="menu-footnote">
            <Icon name="leaf" size={15} />
            <span>Thoughtfully sourced. Freshly made. Always BrewLite.</span>
          </div>
        </section>
      </main>

      {/* 3. Bottom Cart Bar */}
      <div className="cart-bar">
        <div className="cart-inner">
          <div className="cart-total">
            <span className="bag-outline">
              <Icon name="bag" size={23} />
              {count > 0 && <i>{count}</i>}
            </span>
            <div>
              <span>Your daily pick-me-up</span>
              <strong>{money(total)}</strong>
            </div>
          </div>
          <button className="cart-button" onClick={() => setPanel("cart")}>
            <Icon name="bag" size={18} /> View Cart{" "}
            <span className="cart-count">{count}</span>
            <Icon name="arrow" size={18} />
          </button>
        </div>
      </div>

      {/* 4. Modals (Cart Drawer, Notifications, Profile) */}
      {panel && (
        <div className="modal-backdrop" onClick={() => setPanel(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={panel === "cart" ? "Your coffee bag" : panel}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <h2>
                {panel === "cart"
                  ? "Your coffee bag"
                  : panel === "notifications"
                  ? "Fresh from BrewLite"
                  : "Hello, Guest."}
              </h2>
              <button
                className="icon-button"
                aria-label="Close dialog"
                onClick={() => setPanel(null)}
              >
                <Icon name="close" />
              </button>
            </div>
            {panel === "cart" ? (
              ordered ? (
                <div className="empty-state">
                  <span className="empty-icon">
                    <Icon name="check" size={40} />
                  </span>
                  <h3>Order received!</h3>
                  <p>
                    Your coffee moment is on its way.
                    <br />
                    Thanks for choosing BrewLite.
                  </p>
                </div>
              ) : count === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">
                    <Icon name="bag" size={40} />
                  </span>
                  <h3>A little empty, a lot of possibility.</h3>
                  <p>Add your favorites to start your day right.</p>
                  <button
                    className="primary-button"
                    onClick={() => setPanel(null)}
                  >
                    Find your favorite <Icon name="arrow" size={17} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="cart-items">
                    {productsList
                      .filter((p) => cart[p.id])
                      .map((p) => (
                        <div className="cart-item" key={p.id}>
                          <img src={p.image} alt={p.name} />
                          <div>
                            <h4>{p.name}</h4>
                            <span>{money(p.price)}</span>
                          </div>
                          <div className="quantity-controls">
                            <button
                              onClick={() => add(p.id, -1)}
                              aria-label={`Remove one ${p.name}`}
                            >
                              −
                            </button>
                            <span>{cart[p.id]}</span>
                            <button
                              onClick={() => add(p.id)}
                              disabled={cart[p.id] >= p.stock}
                              aria-label={`Add one ${p.name}`}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                  <div className="checkout-total">
                    <span>Total</span>
                    <strong>{money(total)}</strong>
                  </div>
                  <button
                    className="primary-button checkout"
                    onClick={() => {
                      setOrdered(true);
                      setCart({});
                    }}
                  >
                    Place order <Icon name="arrow" />
                  </button>
                  <p className="demo-note">
                    Demo checkout · No payment required
                  </p>
                </>
              )
            ) : panel === "notifications" ? (
              <div className="notification-content">
                <span className="empty-icon">
                  <Icon name="cup" size={32} />
                </span>
                <h3>Freshly brewed, just for you.</h3>
                <p>
                  Our daily menu is ready. Discover your next favorite sip,
                  crafted with love.
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
    </div>
  );
}
