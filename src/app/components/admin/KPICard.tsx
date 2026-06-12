import { ReactNode } from 'react';
import { cn } from '../ui/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  // Support both formats for trend
  change?: number;
  trend?: 'up' | 'down' | { value: number; isPositive: boolean };
  icon?: ReactNode;
  subtitle?: string;
  loading?: boolean;
  className?: string;
}

export function KPICard({ title, value, change, trend, icon, subtitle, loading, className }: KPICardProps) {
  if (loading) {
    return (
      <div className={cn('bg-card rounded-xl border shadow-sm p-6', className)}>
        <div className="space-y-3">
          <div className="h-4 w-24 bg-muted animate-pulse rounded" />
          <div className="h-8 w-32 bg-muted animate-pulse rounded" />
          <div className="h-3 w-16 bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  // Normalize trend data
  let trendValue: number | undefined;
  let trendDirection: 'up' | 'down' | undefined;

  if (typeof trend === 'object' && trend !== null) {
    // New format: { value: number, isPositive: boolean }
    trendValue = trend.value;
    trendDirection = trend.isPositive ? 'up' : 'down';
  } else if (typeof trend === 'string' && change !== undefined) {
    // Old format: separate change and trend props
    trendValue = change;
    trendDirection = trend;
  }

  const showTrend = trendValue !== undefined && trendDirection !== undefined;

  return (
    <div className={cn(
      'group bg-card rounded-xl border shadow-sm p-6 transition-all duration-200 hover:shadow-md hover:border-primary/20',
      className
    )}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
            {icon}
          </div>
        )}
      </div>
      {showTrend && (
        <div className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium',
          trendDirection === 'up'
            ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400'
            : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400'
        )}>
          {trendDirection === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <span>{Math.abs(trendValue!)}%</span>
          <span className="text-xs opacity-75">vs précédent</span>
        </div>
      )}
    </div>
  );
}