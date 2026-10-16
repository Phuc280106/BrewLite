// Định nghĩa toàn bộ kiểu dữ liệu cho Frontend BrewLite

export interface ProductItem {
  id: number;
  name: string;
  note: string;
  price: number;
  stock: number;
  category: string;
  tag?: string;
  image: string;
}

export interface ProductSizeOption {
  id: 'S' | 'M' | 'L' | string;
  label: string;
  extraPrice: number;
}

export interface ProductToppingOption {
  id: string;
  name: string;
  price: number;
}

export interface ProductOptionsResponse {
  sizes: ProductSizeOption[];
  toppings: ProductToppingOption[];
  sizeExtraPrice?: Record<string, number>;
  toppingPrice?: Record<string, number>;
}

export interface CartItemOptions {
  product: ProductItem;
  size: 'S' | 'M' | 'L';
  toppings: string[];
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface CartItem {
  cartItemId: string; // Khóa duy nhất theo: id-size-toppings
  productId: number;
  name: string;
  image: string;
  size: 'S' | 'M' | 'L';
  toppings: string[];
  unitPrice: number;
  quantity: number;
}

export interface CheckoutError {
  message?: string | string[];
}

export interface CreateOrderResponse {
  orderId: number;
  orderCode: string;
  total: number;
  status: string;
  createdAt: string;
}

export type IconName =
  | 'cup'
  | 'bell'
  | 'bag'
  | 'plus'
  | 'arrow'
  | 'close'
  | 'check'
  | 'leaf'
  | 'search';
