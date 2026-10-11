'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ProductItem, CartItem } from '../types';
import Header from '../components/common/Header';
import Icon from '../components/common/Icon';
import PromoBanner from '../components/menu/PromoBanner';
import ProductCard from '../components/menu/ProductCard';
import ProductDetailModal from '../components/ProductDetailModal';
import CartBottomBar from '../components/cart/CartBottomBar';
import CartDrawer from '../components/cart/CartDrawer';

const CATEGORIES = [
  'All Drinks',
  'Coffee',
  'Tea & Fruit',
  'Blended Ice',
  'Pastries',
];

export default function Home() {
  const [productsList, setProductsList] = useState<ProductItem[]>([]);
  const [category, setCategory] = useState('All Drinks');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [panel, setPanel] = useState<'cart' | 'notifications' | 'profile' | null>(null);
  const [state, setState] = useState('Loading');
  const [ordered, setOrdered] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 1. Gọi API từ NestJS Backend (Task 2 & 3)
  useEffect(() => {
    async function fetchProducts() {
      try {
        setState('Loading');
        const backendHost =
          typeof window !== 'undefined' ? window.location.hostname : 'localhost';
        const res = await axios.get(`http://${backendHost}:3001/products`);

        if (res.data && res.data.length > 0) {
          const mapped: ProductItem[] = res.data.map((p: any) => ({
            id: p.id,
            name: p.name,
            note: p.description || 'Hương vị đồ uống tươi mới mỗi ngày',
            price: p.price,
            stock: p.stock,
            category:
              p.category ||
              (p.name.toLowerCase().includes('trà') ? 'Tea & Fruit' : 'Coffee'),
            tag: p.id === 13 || p.id === 1 ? 'Best Seller' : 'In Stock',
            image:
              p.imageUrl ||
              'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=650&q=85',
          }));
          setProductsList(mapped);
          setState('Menu');
        } else {
          setState('Empty');
        }
      } catch (err) {
        console.warn('Lỗi kết nối Backend:', err);
        setState('Menu');
      }
    }

    fetchProducts();
  }, []);

  // 2. Lọc sản phẩm theo Category và Từ khóa tìm kiếm (US-08)
  const filtered = productsList.filter((p) => {
    const matchesCategory =
      category === 'All Drinks' || p.category === category;
    const matchesSearch = p.name
      .toLowerCase()
      .includes(searchKeyword.trim().toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // 3. Tính toán giỏ hàng (Task 4 & 5)
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  // 4. Thêm món từ Modal tùy chỉnh (Task 4 / US-02)
  const handleAddToCartWithOptions = (options: {
    product: ProductItem;
    size: 'S' | 'M' | 'L';
    toppings: string[];
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }) => {
    setOrdered(false);
    const cartItemId = `${options.product.id}-${options.size}-${options.toppings.sort().join('-')}`;

    setCart((prev) => {
      const existingIdx = prev.findIndex((i) => i.cartItemId === cartItemId);
      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx].quantity += options.quantity;
        return updated;
      }
      return [
        ...prev,
        {
          cartItemId,
          productId: options.product.id,
          name: options.product.name,
          image: options.product.image,
          size: options.size,
          toppings: options.toppings,
          unitPrice: options.unitPrice,
          quantity: options.quantity,
        },
      ];
    });

    // Thông báo Toast thành công
    setToastMessage(
      `Đã thêm ${options.quantity}x ${options.product.name} (Size ${options.size}) vào giỏ!`
    );
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 5. Cập nhật số lượng trong giỏ
  const handleUpdateQuantity = (cartItemId: string, change: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cartItemId === cartItemId) {
            const nextQty = item.quantity + change;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  return (
    <div className="app">
      {/* Toast thông báo */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-stone-900/95 backdrop-blur-md text-white text-xs sm:text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl border border-stone-700 flex items-center gap-2.5 animate-fadeIn">
          <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
            ✓
          </span>
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <Header
        onOpenNotifications={() => setPanel('notifications')}
        onOpenProfile={() => setPanel('profile')}
      />

      {/* Main Content */}
      <main className="main">
        {/* Banner Khuyến Mãi */}
        <PromoBanner />

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

          {/* Thanh tìm kiếm đồ uống (US-08) */}
          <div className="mt-4 mb-2 relative max-w-md">
            <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-stone-400">
              <Icon name="search" size={17} />
            </div>
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Tìm kiếm đồ uống theo tên (cà phê, trà đào, matcha...)"
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-stone-200 text-xs sm:text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all shadow-sm"
            />
            {searchKeyword && (
              <button
                onClick={() => setSearchKeyword('')}
                className="absolute inset-y-0 right-3 flex items-center text-xs text-stone-400 hover:text-stone-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Các tab danh mục */}
          <div className="categories" aria-label="Menu categories">
            {CATEGORIES.map((c, i) => (
              <button
                key={c}
                className={`category ${category === c ? 'active' : ''}`}
                onClick={() => setCategory(c)}
              >
                {i === 0 && <Icon name="cup" size={17} />} {c}
              </button>
            ))}
          </div>

          {/* Tiêu đề & Chọn trạng thái demo */}
          <div className="section-title">
            <div>
              <h3>Our menu</h3>
              <span className="item-count">
                {state === 'Empty' ? 0 : filtered.length} items available
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

          {/* Danh sách sản phẩm / Loading / Empty */}
          {state === 'Loading' ? (
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
          ) : state === 'Empty' || filtered.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">
                <Icon name="cup" size={44} />
              </span>
              <h3>Không tìm thấy sản phẩm phù hợp</h3>
              <p>Hãy thử tìm bằng từ khóa khác hoặc chuyển danh mục nhé.</p>
              <button
                className="primary-button"
                onClick={() => {
                  setState('Menu');
                  setCategory('All Drinks');
                  setSearchKeyword('');
                }}
              >
                Xem tất cả đồ uống <Icon name="arrow" size={17} />
              </button>
            </div>
          ) : (
            <div className="product-grid">
              {filtered.map((p) => {
                const totalInCart = cart
                  .filter((item) => item.productId === p.id)
                  .reduce((sum, item) => sum + item.quantity, 0);

                return (
                  <ProductCard
                    key={p.id}
                    product={p}
                    quantityInCart={totalInCart}
                    onSelect={(prod) => setSelectedProduct(prod)}
                  />
                );
              })}
            </div>
          )}

          <div className="menu-footnote">
            <Icon name="leaf" size={15} />
            <span>Thoughtfully sourced. Freshly made. Always BrewLite.</span>
          </div>
        </section>
      </main>

      {/* Thanh Bottom Bar xem giỏ hàng */}
      <CartBottomBar
        count={cartCount}
        total={cartTotal}
        onOpenCart={() => setPanel('cart')}
      />

      {/* Modal Chi tiết & Tùy chọn sản phẩm (Task 4) */}
      <ProductDetailModal
        product={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={handleAddToCartWithOptions}
      />

      {/* Drawer Giỏ hàng */}
      <CartDrawer
        isOpen={panel === 'cart'}
        cart={cart}
        total={cartTotal}
        ordered={ordered}
        onClose={() => setPanel(null)}
        onUpdateQuantity={handleUpdateQuantity}
        onCheckout={() => {
          setOrdered(true);
          setCart([]);
        }}
      />

      {/* Modal Thông báo & Hồ sơ mẫu */}
      {panel && panel !== 'cart' && (
        <div className="modal-backdrop" onClick={() => setPanel(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={panel}
            onClick={(e) => e.stopPropagation()}
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
    </div>
  );
}
