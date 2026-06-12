import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { 
  DollarSign, 
  ShoppingCart, 
  Users, 
  TrendingUp, 
  Package,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowRight,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useRole } from '../contexts/RoleContext';
import { KPICard } from '../components/admin/KPICard';
import { StatusBadge } from '../components/admin/StatusBadge';
import { RoleSwitcher } from '../components/admin/RoleSwitcher';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchOrdersApi, OrderRecord } from '../services/api';
import { toast } from 'sonner';

// Mock data
const revenueData = [
  { date: '1 Mar', value: 12400 },
  { date: '2 Mar', value: 15200 },
  { date: '3 Mar', value: 13800 },
  { date: '4 Mar', value: 16500 },
  { date: '5 Mar', value: 14900 },
  { date: '6 Mar', value: 18200 },
  { date: '7 Mar', value: 17600 },
];

const categoryData = [
  { name: 'Électronique', value: 45000 },
  { name: 'Mode', value: 32000 },
  { name: 'Maison', value: 28000 },
  { name: 'Sports', value: 18000 },
];

const fallbackRecentOrders = [
  { id: '#10245', customer: 'Jean Dupont', status: 'paid', amount: 156, date: '3 Mar 2026' },
  { id: '#10244', customer: 'Marie Martin', status: 'shipped', amount: 289, date: '3 Mar 2026' },
  { id: '#10243', customer: 'Pierre Durand', status: 'delivered', amount: 543, date: '2 Mar 2026' },
  { id: '#10242', customer: 'Sophie Bernard', status: 'pending', amount: 98, date: '2 Mar 2026' },
  { id: '#10241', customer: 'Luc Petit', status: 'paid', amount: 234, date: '2 Mar 2026' },
];

const roleKPIs = {
  Executive: [
    { title: 'Chiffre d\'affaires', value: '€157,340', change: 12.5, trend: 'up' as const, icon: <DollarSign size={24} /> },
    { title: 'Commandes', value: '1,234', change: 8.2, trend: 'up' as const, icon: <ShoppingCart size={24} /> },
    { title: 'Marge estimée', value: '34.2%', change: 2.1, trend: 'up' as const, icon: <TrendingUp size={24} /> },
    { title: 'Clients actifs', value: '847', change: -3.4, trend: 'down' as const, icon: <Users size={24} /> },
  ],
  Operations: [
    { title: 'Commandes en attente', value: '23', icon: <Clock size={24} /> },
    { title: 'Retards livraison', value: '5', icon: <AlertTriangle size={24} /> },
    { title: 'Échecs livraison', value: '2', icon: <AlertTriangle size={24} /> },
    { title: 'Charge active', value: '67%', icon: <Package size={24} /> },
  ],
  Marketing: [
    { title: 'ROAS', value: '3.2x', change: 15.3, trend: 'up' as const, icon: <TrendingUp size={24} /> },
    { title: 'CAC', value: '€24', change: -8.5, trend: 'up' as const, icon: <DollarSign size={24} /> },
    { title: 'MER', value: '12.8%', change: 5.2, trend: 'up' as const, icon: <TrendingUp size={24} /> },
    { title: 'Nouveaux vs récurrents', value: '45/55', icon: <Users size={24} /> },
  ],
  Support: [
    { title: 'Tickets ouverts', value: '12', icon: <AlertTriangle size={24} /> },
    { title: 'Remboursements', value: '8', icon: <DollarSign size={24} /> },
    { title: 'Retours', value: '5', icon: <Package size={24} /> },
    { title: 'Clients bloqués', value: '3', icon: <Users size={24} /> },
  ],
};

const alerts = {
  Executive: [
    { severity: 'warning', title: 'Stock faible détecté', message: '3 produits populaires nécessitent un réapprovisionnement', link: '/admin/products' },
    { severity: 'info', title: 'Performance exceptionnelle', message: 'Les ventes ont dépassé l\'objectif de 15% cette semaine', link: '/admin/analytics' },
  ],
  Operations: [
    { severity: 'danger', title: 'Retards de livraison', message: '5 commandes dépassent le SLA de livraison', link: '/admin/delivery' },
    { severity: 'warning', title: 'Capacité approchée', message: 'La charge opérationnelle atteint 67%', link: '/admin/delivery' },
  ],
  Marketing: [
    { severity: 'warning', title: 'Fatigue campagne', message: 'La campagne Facebook montre des signes de saturation', link: '/admin/marketing' },
    { severity: 'success', title: 'ROI optimal', message: 'La campagne Google Ads performe 28% au-dessus de la moyenne', link: '/admin/marketing' },
  ],
  Support: [
    { severity: 'info', title: 'Tickets en attente', message: '12 tickets nécessitent une attention', link: '/admin/customers' },
    { severity: 'warning', title: 'Temps de réponse élevé', message: 'Le délai moyen de réponse est de 4.2h (objectif: 2h)', link: '/admin/customers' },
  ],
};

const actionQueue = {
  Executive: [
    { priority: 'high', action: 'Approuver budget marketing Q2', dueDate: 'Aujourd\'hui' },
    { priority: 'medium', action: 'Réviser prévisions de stock', dueDate: 'Demain' },
  ],
  Operations: [
    { priority: 'high', action: 'Résoudre retards livraison Tunis', dueDate: 'Aujourd\'hui' },
    { priority: 'high', action: 'Contacter transporteur pour échecs', dueDate: 'Aujourd\'hui' },
  ],
  Marketing: [
    { priority: 'medium', action: 'Optimiser campagne Facebook', dueDate: 'Cette semaine' },
    { priority: 'low', action: 'Préparer newsletter hebdomadaire', dueDate: 'Vendredi' },
  ],
  Support: [
    { priority: 'high', action: 'Traiter remboursements en attente', dueDate: 'Aujourd\'hui' },
    { priority: 'medium', action: 'Répondre aux tickets prioritaires', dueDate: 'Aujourd\'hui' },
  ],
};

function formatOrderDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function toRecentOrder(order: OrderRecord) {
  return {
    id: order.id,
    customer: order.customer,
    status: order.status,
    amount: order.amount,
    date: formatOrderDate(order.date),
  };
}

export function HomePage() {
  const navigate = useNavigate();
  const { role } = useRole();
  const [loading, setLoading] = useState(false);
  const [recentOrders, setRecentOrders] = useState(fallbackRecentOrders);

  useEffect(() => {
    let active = true;

    const loadRecentOrders = async () => {
      setLoading(true);
      try {
        const rows = await fetchOrdersApi();
        if (!active) return;
        const topFive = [...rows]
          .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
          .slice(0, 5)
          .map(toRecentOrder);
        setRecentOrders(topFive.length > 0 ? topFive : fallbackRecentOrders);
      } catch (_error) {
        if (active) {
          setRecentOrders(fallbackRecentOrders);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadRecentOrders();
    return () => {
      active = false;
    };
  }, []);

  const kpis = roleKPIs[role] || roleKPIs.Executive;
  const roleAlerts = alerts[role] || alerts.Executive;
  const actions = actionQueue[role] || actionQueue.Executive;

  return (
    <div className="space-y-8">
      {/* Header with role switcher */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1>Accueil - {role}</h1>
          <p className="text-muted-foreground">Vue d'ensemble de vos activités</p>
        </div>
        <div className="xl:hidden">
          <RoleSwitcher />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, index) => (
          <KPICard key={index} {...kpi} loading={loading} />
        ))}
      </div>

      {/* Executive Summary - Executive only */}
      {role === 'Executive' && (
        <Card className="p-6">
          <h3 className="mb-4">Résumé exécutif du jour</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Aujourd'hui vs Hier</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Revenus</span>
                  <span className="text-sm font-medium text-green-600 flex items-center gap-1">
                    <ArrowUp size={14} /> +12.5%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Commandes</span>
                  <span className="text-sm font-medium text-green-600 flex items-center gap-1">
                    <ArrowUp size={14} /> +8.2%
                  </span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Moyenne 7 jours</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Revenus/jour</span>
                  <span className="text-sm font-medium">€18,520</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Commandes/jour</span>
                  <span className="text-sm font-medium">164</span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Prévision 7 jours</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Revenus projetés</span>
                  <span className="text-sm font-medium">€132,450</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Confiance</span>
                  <span className="text-sm font-medium text-green-600">87%</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="mb-1">Revenu quotidien</h3>
              <p className="text-sm text-muted-foreground">7 derniers jours</p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-muted-foreground">Temps réel</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={revenueData}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid key="grid-revenue" strokeDasharray="3 3" className="stroke-muted/30" />
              <XAxis key="xaxis-revenue" dataKey="date" className="text-xs" stroke="hsl(var(--muted-foreground))" />
              <YAxis key="yaxis-revenue" className="text-xs" stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                key="tooltip-revenue"
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '0.5rem',
                }}
              />
              <Line
                key="line-revenue"
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="mb-1">Contribution par catégorie</h3>
              <p className="text-sm text-muted-foreground">Mois en cours</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={categoryData}>
              <CartesianGrid key="grid-category" strokeDasharray="3 3" className="stroke-muted/30" />
              <XAxis key="xaxis-category" dataKey="name" className="text-xs" stroke="hsl(var(--muted-foreground))" />
              <YAxis key="yaxis-category" className="text-xs" stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                key="tooltip-category"
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '0.5rem',
                }}
              />
              <Bar
                key="bar-category"
                dataKey="value"
                fill="hsl(var(--primary))"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Alerts & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
              <AlertTriangle className="text-amber-600 dark:text-amber-400" size={20} />
            </div>
            <div>
              <h3 className="mb-0">Insights & Alertes</h3>
              <p className="text-sm text-muted-foreground">{roleAlerts.length} notifications</p>
            </div>
          </div>
          <div className="space-y-3">
            {roleAlerts.map((alert, index) => (
              <div key={index} className="group p-4 rounded-xl border bg-card hover:shadow-md hover:border-primary/20 transition-all cursor-pointer">
                <div className="flex items-start gap-3">
                  <StatusBadge
                    status={alert.severity === 'danger' ? 'Urgent' : alert.severity === 'warning' ? 'Attention' : alert.severity === 'success' ? 'Succès' : 'Info'}
                    type={alert.severity as any}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm mb-1">{alert.title}</p>
                    <p className="text-sm text-muted-foreground mb-2">{alert.message}</p>
                    <Link to={alert.link} className="text-sm font-medium text-primary group-hover:underline inline-flex items-center gap-1">
                      Voir détails <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
              <CheckCircle2 className="text-blue-600 dark:text-blue-400" size={20} />
            </div>
            <div>
              <h3 className="mb-0">File d'actions</h3>
              <p className="text-sm text-muted-foreground">{actions.length} tâches en attente</p>
            </div>
          </div>
          <div className="space-y-3">
            {actions.map((action, index) => (
              <div key={index} className="group p-4 rounded-xl border bg-card hover:shadow-md hover:border-primary/20 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <StatusBadge
                        status={action.priority === 'high' ? 'Haute' : action.priority === 'medium' ? 'Moyenne' : 'Basse'}
                        type={action.priority === 'high' ? 'danger' : action.priority === 'medium' ? 'warning' : 'info'}
                      />
                      <span className="text-xs font-medium text-muted-foreground">{action.dueDate}</span>
                    </div>
                    <p className="text-sm font-medium leading-relaxed">{action.action}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                    onClick={() => {
                      toast.success(`Action marquee comme traitee: ${action.action}`);
                      navigate('/admin/orders');
                    }}
                  >
                    Traiter
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent Orders Table */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between p-6 pb-4">
          <div>
            <h3 className="mb-1">Commandes récentes</h3>
            <p className="text-sm text-muted-foreground">Dernières transactions</p>
          </div>
          <Link to="/admin/orders">
            <Button variant="ghost" size="sm" className="gap-2 hover:gap-3 transition-all">
              Voir tout <ArrowRight size={16} />
            </Button>
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left py-3 px-6 text-sm font-semibold text-muted-foreground">ID</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Client</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Statut</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-muted-foreground">Montant</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Date</th>
                <th className="text-right py-3 px-6 text-sm font-semibold text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id} className="border-b last:border-0 hover:bg-accent/30 transition-colors group">
                  <td className="py-4 px-6 text-sm font-mono font-semibold">{order.id}</td>
                  <td className="py-4 px-4 text-sm font-medium">{order.customer}</td>
                  <td className="py-4 px-4">
                    <StatusBadge
                      status={order.status === 'paid' ? 'Payé' : order.status === 'shipped' ? 'Expédié' : order.status === 'delivered' ? 'Livré' : 'En attente'}
                      type={order.status as any}
                    />
                  </td>
                  <td className="py-4 px-4 text-sm text-right font-semibold">€{order.amount}</td>
                  <td className="py-4 px-4 text-sm text-muted-foreground">{order.date}</td>
                  <td className="py-4 px-6 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => navigate('/admin/orders')}
                    >
                      Voir
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
