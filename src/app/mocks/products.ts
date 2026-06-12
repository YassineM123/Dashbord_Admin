import type { ProductStatus } from '../constants';

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  status: ProductStatus;
  image?: string;
  sku?: string;
}

export const mockProducts: Product[] = [
  {
    id: '1',
    name: 'MacBook Pro 16"',
    category: 'Électronique',
    price: 2499,
    stock: 12,
    status: 'active',
    sku: 'MBP-16-001',
  },
  {
    id: '2',
    name: 'iPhone 15 Pro',
    category: 'Électronique',
    price: 1199,
    stock: 3,
    status: 'active',
    sku: 'IPH-15P-001',
  },
  {
    id: '3',
    name: 'AirPods Pro',
    category: 'Électronique',
    price: 279,
    stock: 45,
    status: 'active',
    sku: 'APP-GEN2-001',
  },
  {
    id: '4',
    name: 'Magic Keyboard',
    category: 'Accessoires',
    price: 149,
    stock: 0,
    status: 'out_of_stock',
    sku: 'MKB-FR-001',
  },
  {
    id: '5',
    name: 'Apple Watch Series 9',
    category: 'Électronique',
    price: 449,
    stock: 28,
    status: 'active',
    sku: 'AWS9-45-001',
  },
  {
    id: '6',
    name: 'iPad Air',
    category: 'Électronique',
    price: 649,
    stock: 15,
    status: 'active',
    sku: 'IPA-AIR-001',
  },
  {
    id: '7',
    name: 'HomePod mini',
    category: 'Audio',
    price: 99,
    stock: 0,
    status: 'out_of_stock',
    sku: 'HPM-WHT-001',
  },
  {
    id: '8',
    name: 'Apple Pencil (2e gen)',
    category: 'Accessoires',
    price: 139,
    stock: 22,
    status: 'active',
    sku: 'APC-GEN2-001',
  },
];

export const mockCategories = [
  { name: 'Électronique', value: 45000, count: 156 },
  { name: 'Mode', value: 32000, count: 89 },
  { name: 'Maison', value: 28000, count: 134 },
  { name: 'Sports', value: 18000, count: 67 },
  { name: 'Accessoires', value: 15000, count: 203 },
];
