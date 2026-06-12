import { useState } from 'react';
import { Plus, TrendingUp, AlertTriangle, Calendar, Target } from 'lucide-react';
import { KPICard } from '../components/admin/KPICard';
import { StatusBadge } from '../components/admin/StatusBadge';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

const channels = [
  { name: 'Google Ads', spend: 5200, revenue: 18500, acquisitions: 234, cac: 22, roas: 3.6, trend: [40, 45, 50, 55, 60, 58, 62] },
  { name: 'Facebook Ads', spend: 3800, revenue: 11400, acquisitions: 189, cac: 20, roas: 3.0, trend: [50, 48, 45, 43, 40, 38, 35] },
  { name: 'Instagram Ads', spend: 2100, revenue: 7350, acquisitions: 143, cac: 15, roas: 3.5, trend: [30, 32, 35, 38, 40, 42, 45] },
];

const fatigueSignals = [
  { campaign: 'Facebook - Promo Été', severity: 'warning', issue: 'CTR en baisse de 45% sur 7 jours', frequency: 4.2 },
  { campaign: 'Google Shopping', severity: 'danger', issue: 'CPC augmenté de 60%', frequency: 2.1 },
];

const coupons = [
  { code: 'SUMMER20', type: '20% réduction', usage: '45/100', expiry: '30 Juin 2026', status: 'active' },
  { code: 'WELCOME10', type: '10€ offerts', usage: '234/∞', expiry: 'Permanent', status: 'active' },
];

export function MarketingPage() {
  const [couponDialogOpen, setCouponDialogOpen] = useState(false);

  const handleQuickAction = (label: string) => {
    toast.success(`Action lancee: ${label}`);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1>Marketing</h1>
        <p className="text-muted-foreground">Gérez vos campagnes et performances marketing</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard title="CAC blended" value="€24" change={-8.5} trend="up" icon={<TrendingUp size={24} />} />
        <KPICard title="ROAS blended" value="3.2x" change={15.3} trend="up" icon={<TrendingUp size={24} />} />
        <KPICard title="MER" value="12.8%" change={5.2} trend="up" icon={<TrendingUp size={24} />} />
        <KPICard title="Nouveaux vs récurrents" value="45/55" icon={<Target size={24} />} />
      </div>

      {/* Channel Attribution */}
      <Card className="p-6">
        <h3 className="mb-4">Attribution par canal</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b">
              <tr>
                <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Canal</th>
                <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Dépense</th>
                <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Revenu</th>
                <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Acquisitions</th>
                <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">CAC</th>
                <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">ROAS</th>
                <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Tendance</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((channel) => (
                <tr key={channel.name} className="border-b hover:bg-accent/50">
                  <td className="py-3 px-2 text-sm font-medium">{channel.name}</td>
                  <td className="py-3 px-2 text-sm text-right">€{channel.spend}</td>
                  <td className="py-3 px-2 text-sm text-right font-medium">€{channel.revenue}</td>
                  <td className="py-3 px-2 text-sm text-right">{channel.acquisitions}</td>
                  <td className="py-3 px-2 text-sm text-right">€{channel.cac}</td>
                  <td className="py-3 px-2 text-sm text-right font-medium">{channel.roas}x</td>
                  <td className="py-3 px-2">
                    <ResponsiveContainer width={80} height={30}>
                      <LineChart data={channel.trend.map((v, i) => ({ v }))}>
                        <Line key={`line-${channel.name}`} type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Fatigue Signals & Abandoned Carts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="mb-4">Signaux de fatigue campagne</h3>
          <div className="space-y-3">
            {fatigueSignals.map((signal, index) => (
              <div key={index} className="p-4 rounded-lg border bg-card">
                <div className="flex items-start gap-3">
                  <StatusBadge
                    status={signal.severity === 'danger' ? 'Critique' : 'Attention'}
                    type={signal.severity as any}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm mb-1">{signal.campaign}</p>
                    <p className="text-sm text-muted-foreground mb-2">{signal.issue}</p>
                    <p className="text-xs text-muted-foreground">Fréquence: {signal.frequency}x</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleQuickAction(`Optimisation ${signal.campaign}`)}>Optimiser</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="mb-4">Paniers abandonnés</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Paniers actifs</p>
                <p className="text-2xl font-semibold">34</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valeur totale</p>
                <p className="text-2xl font-semibold">€4,523</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taux récup.</p>
                <p className="text-2xl font-semibold">28%</p>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => handleQuickAction('Rappels paniers abandonnes')}>Envoyer rappels</Button>
              <Button variant="outline" className="flex-1" onClick={() => setCouponDialogOpen(true)}>Offrir coupon</Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Coupons & Segments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3>Coupons</h3>
            <Button size="sm" onClick={() => setCouponDialogOpen(true)} className="gap-2">
              <Plus size={16} />
              Créer
            </Button>
          </div>
          <div className="space-y-2">
            {coupons.map((coupon) => (
              <div key={coupon.code} className="p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm mb-1">{coupon.code}</p>
                    <p className="text-xs text-muted-foreground">{coupon.type}</p>
                  </div>
                  <StatusBadge status="Actif" type="success" />
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                  <span>Usage: {coupon.usage}</span>
                  <span>Expire: {coupon.expiry}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="mb-4">Segments clients</h3>
          <div className="space-y-3">
            <div className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium">VIP (LTV &gt; €1000)</p>
                <span className="text-2xl font-semibold">127</span>
              </div>
              <Button size="sm" variant="outline" className="w-full" onClick={() => handleQuickAction('Campagne segment VIP')}>Cibler campagne</Button>
            </div>
            <div className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium">Nouveaux (30j)</p>
                <span className="text-2xl font-semibold">234</span>
              </div>
              <Button size="sm" variant="outline" className="w-full" onClick={() => handleQuickAction('Sequence welcome nouveaux clients')}>Envoyer welcome</Button>
            </div>
            <div className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium">Inactifs (90j+)</p>
                <span className="text-2xl font-semibold">89</span>
              </div>
              <Button size="sm" variant="outline" className="w-full" onClick={() => handleQuickAction('Campagne de reengagement')}>Campagne réengagement</Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Create Coupon Dialog */}
      <Dialog open={couponDialogOpen} onOpenChange={setCouponDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un coupon</DialogTitle>
            <DialogDescription>Créez un nouveau coupon pour vos clients.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Code</Label>
              <Input placeholder="SUMMER20" />
            </div>
            <div className="space-y-2">
              <Label>Type de réduction</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Pourcentage</SelectItem>
                  <SelectItem value="fixed">Montant fixe</SelectItem>
                  <SelectItem value="free_shipping">Livraison gratuite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valeur</Label>
              <Input placeholder="20" type="number" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date d'expiration</Label>
                <Input type="date" />
              </div>
              <div className="space-y-2">
                <Label>Limite d'usage</Label>
                <Input placeholder="100" type="number" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCouponDialogOpen(false)}>Annuler</Button>
            <Button
              onClick={() => {
                setCouponDialogOpen(false);
                toast.success('Coupon cree');
              }}
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
