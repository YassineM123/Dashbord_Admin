// Order Status
export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'canceled';

export const ORDER_STATUS: Record<OrderStatus, { label: string; type: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
  pending: { label: 'En attente', type: 'warning' },
  paid: { label: 'Payé', type: 'info' },
  shipped: { label: 'Expédié', type: 'info' },
  delivered: { label: 'Livré', type: 'success' },
  canceled: { label: 'Annulé', type: 'danger' },
};

// Product Status
export type ProductStatus = 'active' | 'inactive' | 'out_of_stock';

export const PRODUCT_STATUS: Record<ProductStatus, { label: string; type: 'default' | 'success' | 'warning' | 'danger' }> = {
  active: { label: 'Actif', type: 'success' },
  inactive: { label: 'Inactif', type: 'warning' },
  out_of_stock: { label: 'Rupture', type: 'danger' },
};

// Delivery Status
export type DeliveryStatus = 'pending' | 'in_transit' | 'delivered' | 'failed' | 'returned';

export const DELIVERY_STATUS: Record<DeliveryStatus, { label: string; type: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
  pending: { label: 'En attente', type: 'warning' },
  in_transit: { label: 'En transit', type: 'info' },
  delivered: { label: 'Livré', type: 'success' },
  failed: { label: 'Échec', type: 'danger' },
  returned: { label: 'Retourné', type: 'warning' },
};

// Lead Status
export type LeadStatus = 'nouveau' | 'contacte' | 'converti';

export const LEAD_STATUS: Record<LeadStatus, { label: string; type: 'default' | 'success' | 'warning' | 'info' }> = {
  nouveau: { label: 'Nouveau', type: 'info' },
  contacte: { label: 'Contacté', type: 'warning' },
  converti: { label: 'Converti', type: 'success' },
};

// AI Order Status
export type AIOrderStatus = 'brouillon' | 'confirme' | 'annule';

export const AI_ORDER_STATUS: Record<AIOrderStatus, { label: string; type: 'default' | 'success' | 'warning' | 'danger' }> = {
  brouillon: { label: 'Brouillon', type: 'warning' },
  confirme: { label: 'Confirmé', type: 'success' },
  annule: { label: 'Annulé', type: 'danger' },
};

// Date Presets
export type DatePreset = '7j' | '30j' | '90j' | '1an';

export const DATE_PRESETS: Record<DatePreset, { label: string; days: number }> = {
  '7j': { label: '7 derniers jours', days: 7 },
  '30j': { label: '30 derniers jours', days: 30 },
  '90j': { label: '90 derniers jours', days: 90 },
  '1an': { label: '1 an', days: 365 },
};

// Roles
export type UserRole = 'Executive' | 'Operations' | 'Marketing' | 'Support';

export const USER_ROLES: UserRole[] = ['Executive', 'Operations', 'Marketing', 'Support'];

// Payment Methods
export type PaymentMethod = 'card' | 'bank_transfer' | 'cash' | 'paypal';

export const PAYMENT_METHODS: Record<PaymentMethod, string> = {
  card: 'Carte bancaire',
  bank_transfer: 'Virement',
  cash: 'Espèces',
  paypal: 'PayPal',
};

// Alert Severity
export type AlertSeverity = 'info' | 'success' | 'warning' | 'danger';

// Priority Levels
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'text-blue-500',
  medium: 'text-yellow-500',
  high: 'text-orange-500',
  critical: 'text-red-500',
};

// Table Page Sizes
export const PAGE_SIZES = [10, 25, 50, 100];
export const DEFAULT_PAGE_SIZE = 25;

// Chart Colors
export const CHART_COLORS = {
  primary: 'hsl(var(--primary))',
  secondary: 'hsl(var(--secondary))',
  success: 'hsl(142, 76%, 36%)',
  warning: 'hsl(38, 92%, 50%)',
  danger: 'hsl(0, 72%, 51%)',
  info: 'hsl(199, 89%, 48%)',
  chart1: 'hsl(var(--chart-1))',
  chart2: 'hsl(var(--chart-2))',
  chart3: 'hsl(var(--chart-3))',
  chart4: 'hsl(var(--chart-4))',
  chart5: 'hsl(var(--chart-5))',
};
