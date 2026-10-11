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
