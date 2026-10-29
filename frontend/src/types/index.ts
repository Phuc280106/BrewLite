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

export interface UserProfile {
  id: number;
  email: string;
  name: string | null;
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

export interface Promotion {
  id: number;
  code: string;
  description: string | null;
  discountPercent: number | null;
  discountAmount: number | null;
  minOrder: number;
  isActive: boolean;
}

export interface ValidatePromotionResponse {
  code: string;
  description: string | null;
  discount: number;
  discountPercent: number | null;
  discountAmount: number | null;
  finalTotal: number;
}

export type PaymentMethod = 'MOMO' | 'VNPAY' | 'CARD';

export interface PaymentResponse {
  idempotent: boolean;
  payment: {
    id: number;
    orderId: number;
    amount: number;
    method: 'WALLET' | 'CARD';
    idempotencyKey: string;
    createdAt: string;
  };
  loyaltyPointsEarned?: number;
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
