import { cn } from '../ui/utils';

type StatusType = 'success' | 'warning' | 'danger' | 'info' | 'pending' | 'paid' | 'shipped' | 'delivered' | 'canceled' | 'refunded';

interface StatusBadgeProps {
  status: string;
  type?: StatusType | string;
  className?: string;
}

const statusConfig: Record<StatusType, { bg: string; text: string }> = {
  success: { bg: 'bg-green-100 dark:bg-green-950', text: 'text-green-700 dark:text-green-400' },
  warning: { bg: 'bg-amber-100 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-400' },
  danger: { bg: 'bg-red-100 dark:bg-red-950', text: 'text-red-700 dark:text-red-400' },
  info: { bg: 'bg-blue-100 dark:bg-blue-950', text: 'text-blue-700 dark:text-blue-400' },
  pending: { bg: 'bg-amber-100 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-400' },
  paid: { bg: 'bg-blue-100 dark:bg-blue-950', text: 'text-blue-700 dark:text-blue-400' },
  shipped: { bg: 'bg-purple-100 dark:bg-purple-950', text: 'text-purple-700 dark:text-purple-400' },
  delivered: { bg: 'bg-green-100 dark:bg-green-950', text: 'text-green-700 dark:text-green-400' },
  canceled: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-400' },
  refunded: { bg: 'bg-red-100 dark:bg-red-950', text: 'text-red-700 dark:text-red-400' },
};

const statusAliases: Record<string, StatusType> = {
  new: 'pending',
  confirmed: 'paid',
  preparing: 'warning',
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'canceled',
  canceled: 'canceled',
  returned: 'refunded',
  unpaid: 'pending',
  paid: 'paid',
  'cash on delivery': 'warning',
  refunded: 'refunded',
  waiting: 'pending',
  assigned: 'info',
  'picked up': 'shipped',
  'on the way': 'shipped',
  failed: 'danger',
  available: 'success',
  low_stock: 'warning',
  out_of_stock: 'danger',
  active: 'success',
  paused: 'warning',
  draft: 'pending',
  scheduled: 'info',
  sent: 'success',
  connected: 'success',
  disconnected: 'warning',
};

function resolveStatusType(status: string, type?: StatusType | string): StatusType {
  const typeKey = String(type || '').trim().toLowerCase();
  if (typeKey && typeKey in statusConfig) {
    return typeKey as StatusType;
  }
  if (typeKey && statusAliases[typeKey]) {
    return statusAliases[typeKey];
  }
  const statusKey = String(status || '').trim().toLowerCase();
  return statusAliases[statusKey] || 'info';
}

export function StatusBadge({ status, type = 'info', className }: StatusBadgeProps) {
  const config = statusConfig[resolveStatusType(status, type)];
  
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      config.bg,
      config.text,
      className
    )}>
      {status}
    </span>
  );
}
