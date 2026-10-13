'use client';

import { useEffect, useState } from 'react';
import { ProductItem } from '../../types';
import { api, Product as ProductResponse } from '../../lib/api';
import ProductDetailModal from '../product/ProductDetailModal';
import Icon from '../common/Icon';
import ProductCard from './ProductCard';
import { useCartStore } from '../cart/useCartStore';

const CATEGORIES = [
  'All Drinks',
  'Coffee',
  'Tea & Fruit',
  'Blended Ice',
  'Pastries',
];

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=650&q=85';

type MenuState = 'Loading' | 'Menu' | 'Empty';

function toProductItem(product: ProductResponse): ProductItem {
  return {
    id: product.id,
    name: product.name,
    note: product.description || 'Hương vị đồ uống tươi mới mỗi ngày',
    price: product.price,
    stock: product.stock,
    category:
      product.category ||
      (product.name.toLowerCase().includes('trà') ? 'Tea & Fruit' : 'Coffee'),
    tag: product.id === 13 || product.id === 1 ? 'Best Seller' : 'In Stock',
    image: product.imageUrl || FALLBACK_IMAGE,
  };
}

export default function MenuSection() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [category, setCategory] = useState('All Drinks');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [menuState, setMenuState] = useState<MenuState>('Loading');
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(
    null
  );
  const cart = useCartStore((state) => state.cart);
  const addToCart = useCartStore((state) => state.addToCart);

  useEffect(() => {
    async function fetchProducts() {
      try {
        setMenuState('Loading');
        const response = await api.get<ProductResponse[]>('/products');

        if (response.data.length > 0) {
          setProducts(response.data.map(toProductItem));
          setMenuState('Menu');
        } else {
          setMenuState('Empty');
        }
      } catch (error) {
        console.warn('Lỗi kết nối Backend:', error);
        setMenuState('Menu');
      }
    }

    void fetchProducts();
  }, []);

  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      category === 'All Drinks' || product.category === category;
    const matchesSearch = product.name
      .toLowerCase()
      .includes(searchKeyword.trim().toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const resetFilters = () => {
    setMenuState('Menu');
    setCategory('All Drinks');
    setSearchKeyword('');
  };

  return (
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

      <div className="mt-4 mb-2 relative max-w-md">
        <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-stone-400">
          <Icon name="search" size={17} />
        </div>
        <input
          type="text"
          value={searchKeyword}
          onChange={(event) => setSearchKeyword(event.target.value)}
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

      <div className="categories" aria-label="Menu categories">
        {CATEGORIES.map((item, index) => (
          <button
            key={item}
            className={`category ${category === item ? 'active' : ''}`}
            onClick={() => setCategory(item)}
          >
            {index === 0 && <Icon name="cup" size={17} />} {item}
          </button>
        ))}
      </div>

      <div className="section-title">
        <div>
          <h3>Our menu</h3>
          <span className="item-count">
            {menuState === 'Empty' ? 0 : filteredProducts.length} items available
          </span>
        </div>
        <label className="state-control">
          <span className="sr-only">Preview menu state</span>
          <select
            aria-label="Preview menu state"
            value={menuState}
            onChange={(event) => setMenuState(event.target.value as MenuState)}
          >
            <option value="Menu">Menu (Default)</option>
            <option value="Loading">Loading State</option>
            <option value="Empty">Empty State</option>
          </select>
        </label>
      </div>

      {menuState === 'Loading' ? (
        <div
          className="product-grid"
          aria-label="Loading menu"
          aria-busy="true"
        >
          {[0, 1, 2, 3].map((index) => (
            <div className="product-card skeleton" key={index}>
              <div className="skeleton-image" />
              <div className="skeleton-line" />
              <div className="skeleton-line short" />
              <div className="skeleton-line" />
            </div>
          ))}
        </div>
      ) : menuState === 'Empty' || filteredProducts.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">
            <Icon name="cup" size={44} />
          </span>
          <h3>Không tìm thấy sản phẩm phù hợp</h3>
          <p>Hãy thử tìm bằng từ khóa khác hoặc chuyển danh mục nhé.</p>
          <button className="primary-button" onClick={resetFilters}>
            Xem tất cả đồ uống <Icon name="arrow" size={17} />
          </button>
        </div>
      ) : (
        <div className="product-grid">
          {filteredProducts.map((product) => {
            const quantityInCart = cart
              .filter((item) => item.productId === product.id)
              .reduce((sum, item) => sum + item.quantity, 0);

            return (
              <ProductCard
                key={product.id}
                product={product}
                quantityInCart={quantityInCart}
                onSelect={setSelectedProduct}
              />
            );
          })}
        </div>
      )}

      <div className="menu-footnote">
        <Icon name="leaf" size={15} />
        <span>Thoughtfully sourced. Freshly made. Always BrewLite.</span>
      </div>

      <ProductDetailModal
        product={selectedProduct}
        isOpen={selectedProduct !== null}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={addToCart}
      />
    </section>
  );
}
