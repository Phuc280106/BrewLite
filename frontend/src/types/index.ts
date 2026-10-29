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

export type UserRole = 'CUSTOMER' | 'BARISTA' | 'STAFF' | string;

export interface UserProfile {
  id: number;
  email: string;
  name: string | null;
  role?: UserRole;
  loyaltyPoints: number;
}

export interface AuthResponse {
  message: string;
  accessToken: string;
  user: UserProfile;
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
  discount?: number;
  couponCode?: string | null;
  status: string;
  createdAt: string;
}

export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'PAYMENT_FAILED'
  | 'CANCELLED';

export interface OrderItemProduct {
  id: number;
  name: string;
  imageUrl?: string;
  price: number;
}

export interface OrderItemDetail {
  id: number;
  orderId?: number;
  productId: number;
  size: 'S' | 'M' | 'L' | string;
  toppings: string | string[] | null;
  price: number;
  qty: number;
  lineTotal: number;
  product?: OrderItemProduct;
}

export interface OrderDetail {
  id: number;
  orderCode: string;
  userId?: number | null;
  total: number;
  status: OrderStatus | string;
  createdAt: string;
  updatedAt?: string;
  items: OrderItemDetail[];
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
