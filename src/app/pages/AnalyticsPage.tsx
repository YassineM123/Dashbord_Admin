import { useState } from 'react';
import { Download } from 'lucide-react';
import { KPICard } from '../components/admin/KPICard';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { exportToCSV } from '../utils/helpers';
import { toast } from 'sonner';

const revenueData = Array.from({ length: 30 }, (_, i) => ({
  date: `${i + 1} Fév`,
  revenue: Math.floor(Math.random() * 5000) + 12000,
  previousRevenue: Math.floor(Math.random() * 5000) + 10000,
}));

const categoryPerformance = [
  { category: 'Électronique', revenue: 45000, orders: 234, avgOrder: 192 },
  { category: 'Mode', revenue: 32000, orders: 456, avgOrder: 70 },
  { category: 'Maison', revenue: 28000, orders: 189, avgOrder: 148 },
  { category: 'Sports', revenue: 18000, orders: 312, avgOrder: 58 },
  { category: 'Beauté', revenue: 15000, orders: 278, avgOrder: 54 },
];

const ordersData = Array.from({ length: 30 }, (_, i) => ({
  date: `${i + 1}`,
  orders: Math.floor(Math.random() * 50) + 100,
}));

export function AnalyticsPage() {
  const [compareEnabled, setCompareEnabled] = useState(false);

  const handleExportAnalytics = () => {
    exportToCSV(revenueData, `analytics-revenu-${new Date().toISOString().split('T')[0]}`);
    toast.success('Export analytics termine');
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1>Analytics</h1>
          <p className="text-muted-foreground">Analyses détaillées de vos performances</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="compare"
              checked={compareEnabled}
              onCheckedChange={setCompareEnabled}
            />
            <Label htmlFor="compare">Comparer à période précédente</Label>
          </div>
          <Button className="gap-2" onClick={handleExportAnalytics}>
            <Download size={16} />
            Exporter
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Taux de conversion"
          value="3.42%"
          change={0.8}
          trend="up"
        />
        <KPICard
          title="Clients récurrents"
          value="567"
          change={12.3}
          trend="up"
        />
        <KPICard
          title="Nouveaux clients"
          value="234"
          change={-5.2}
          trend="down"
        />
        <KPICard
          title="Panier moyen"
          value="€142"
          change={8.7}
          trend="up"
        />
      </div>

      {/* Revenue Trend */}
      <Card className="p-6">
        <h3 className="mb-4">Tendance du revenu mensuel</h3>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={revenueData}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop key="stop-revenue-1" offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                <stop key="stop-revenue-2" offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
              </linearGradient>
              {compareEnabled && (
                <linearGradient id="colorPrevious" x1="0" y1="0" x2="0" y2="1">
                  <stop key="stop-previous-1" offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.3}/>
                  <stop key="stop-previous-2" offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0}/>
                </linearGradient>
              )}
            </defs>
            <CartesianGrid key="grid-area" strokeDasharray="3 3" className="stroke-muted" />
            <XAxis key="xaxis-area" dataKey="date" className="text-xs" />
            <YAxis key="yaxis-area" className="text-xs" />
            <Tooltip key="tooltip-area" />
            <Legend key="legend-area" />
            <Area
              key="area-revenue"
              type="monotone"
              dataKey="revenue"
              stroke="hsl(var(--primary))"
              fill="url(#colorRevenue)"
              name="Revenu actuel"
            />
            {compareEnabled && (
              <Area
                key="area-previous"
                type="monotone"
                dataKey="previousRevenue"
                stroke="hsl(var(--muted-foreground))"
                fill="url(#colorPrevious)"
                name="Période précédente"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Category Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="mb-4">Performance par catégorie</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={categoryPerformance}>
              <CartesianGrid key="grid-bar-cat" strokeDasharray="3 3" className="stroke-muted" />
              <XAxis key="xaxis-bar-cat" dataKey="category" className="text-xs" />
              <YAxis key="yaxis-bar-cat" className="text-xs" />
              <Tooltip key="tooltip-bar-cat" />
              <Bar key="bar-cat-revenue" dataKey="revenue" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="mb-4">Détails par catégorie</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 text-sm font-medium text-muted-foreground">Catégorie</th>
                  <th className="text-right py-2 text-sm font-medium text-muted-foreground">Revenu</th>
                  <th className="text-right py-2 text-sm font-medium text-muted-foreground">Commandes</th>
                  <th className="text-right py-2 text-sm font-medium text-muted-foreground">Panier moy.</th>
                </tr>
              </thead>
              <tbody>
                {categoryPerformance.map((cat) => (
                  <tr key={cat.category} className="border-b hover:bg-accent/50">
                    <td className="py-3 text-sm font-medium">{cat.category}</td>
                    <td className="py-3 text-sm text-right">€{cat.revenue.toLocaleString()}</td>
                    <td className="py-3 text-sm text-right">{cat.orders}</td>
                    <td className="py-3 text-sm text-right">€{cat.avgOrder}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Orders Trend */}
      <Card className="p-6">
        <h3 className="mb-4">Tendance des commandes quotidiennes</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={ordersData}>
            <CartesianGrid key="grid-line-orders" strokeDasharray="3 3" className="stroke-muted" />
            <XAxis key="xaxis-line-orders" dataKey="date" className="text-xs" />
            <YAxis key="yaxis-line-orders" className="text-xs" />
            <Tooltip key="tooltip-line-orders" />
            <Line key="line-orders" type="monotone" dataKey="orders" stroke="hsl(var(--primary))" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
