import type { OrderStatus } from '../constants';

export interface Order {
  id: string;
  customer: string;
  status: OrderStatus;
  amount: number;
  date: string;
  items?: number;
  payment?: string;
}

export const mockOrders: Order[] = [
  { id: '#10245', customer: 'Jean Dupont', status: 'paid', amount: 156, date: '2026-03-03', items: 2 },
  { id: '#10244', customer: 'Marie Martin', status: 'shipped', amount: 289, date: '2026-03-03', items: 1 },
  { id: '#10243', customer: 'Pierre Durand', status: 'delivered', amount: 543, date: '2026-03-02', items: 3 },
  { id: '#10242', customer: 'Sophie Bernard', status: 'pending', amount: 98, date: '2026-03-02', items: 1 },
  { id: '#10241', customer: 'Luc Petit', status: 'paid', amount: 234, date: '2026-03-02', items: 2 },
  { id: '#10240', customer: 'Emma Dubois', status: 'delivered', amount: 445, date: '2026-03-01', items: 4 },
  { id: '#10239', customer: 'Thomas Leroy', status: 'shipped', amount: 178, date: '2026-03-01', items: 2 },
  { id: '#10238', customer: 'Julie Moreau', status: 'canceled', amount: 320, date: '2026-02-29', items: 3 },
  { id: '#10237', customer: 'Nicolas Simon', status: 'delivered', amount: 256, date: '2026-02-29', items: 1 },
  { id: '#10236', customer: 'Céline Laurent', status: 'paid', amount: 189, date: '2026-02-28', items: 2 },
];
