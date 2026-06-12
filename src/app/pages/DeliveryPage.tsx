import { useEffect, useMemo, useState } from 'react';
import { Clock, AlertTriangle, Package } from 'lucide-react';
import { KPICard } from '../components/admin/KPICard';
import { StatusBadge } from '../components/admin/StatusBadge';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../components/ui/sheet';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { fetchOrdersApi, OrderRecord, updateOrderApi } from '../services/api';
import { toast } from 'sonner';

const fallbackOrders: OrderRecord[] = [
  { id: '#10245', customer: 'Jean Dupont', email: 'jean@example.com', status: 'paid', payment: 'CB', delivery: 'pending', amount: 156, date: '2026-03-03T14:23:00Z', city: 'Tunis', address: '123 Avenue Habib Bourguiba, Tunis' },
  { id: '#10244', customer: 'Marie Martin', email: 'marie@example.com', status: 'shipped', payment: 'CB', delivery: 'in_transit', amount: 289, date: '2026-03-03T10:15:00Z', city: 'Sousse', address: 'Rue de la Republique, Sousse', courier: 'Aramex', tracking: 'AR123456' },
  { id: '#10243', customer: 'Pierre Durand', email: 'pierre@example.com', status: 'delivered', payment: 'COD', delivery: 'delivered', amount: 543, date: '2026-03-02T16:42:00Z', city: 'Sfax', address: 'Boulevard Tahar Sfar, Sfax', courier: 'DHL', tracking: 'DH789012' },
  { id: '#10242', customer: 'Sophie Bernard', email: 'sophie@example.com', status: 'pending', payment: 'Pending', delivery: 'not_shipped', amount: 98, date: '2026-03-02T09:18:00Z', city: 'Nabeul', address: 'Avenue Habib Thameur, Nabeul' },
  { id: '#10241', customer: 'Luc Petit', email: 'luc@example.com', status: 'paid', payment: 'CB', delivery: 'pending', amount: 234, date: '2026-03-02T08:05:00Z', city: 'Bizerte', address: 'Avenue de la Corniche, Bizerte' },
];

const deliveryStatuses = ['not_shipped', 'pending', 'in_transit', 'delivered', 'failed'] as const;
type DeliveryStatus = typeof deliveryStatuses[number];

const deliveryStatusLabels: Record<DeliveryStatus, string> = {
  not_shipped: 'Non expedie',
  pending: 'En attente',
  in_transit: 'En transit',
  delivered: 'Livre',
  failed: 'Echec',
};

const deliveryStatusTypes: Record<DeliveryStatus, 'success' | 'warning' | 'danger' | 'info'> = {
  not_shipped: 'warning',
  pending: 'warning',
  in_transit: 'info',
  delivered: 'success',
  failed: 'danger',
};

function normalizeDeliveryStatus(value: string): DeliveryStatus {
  return deliveryStatuses.includes(value as DeliveryStatus) ? (value as DeliveryStatus) : 'pending';
}

function parseDate(value?: string) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(value?: string) {
  const date = parseDate(value);
  if (!date) {
    return '-';
  }
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function toDateInputValue(value?: string) {
  const date = parseDate(value);
  return date ? date.toISOString().slice(0, 10) : '';
}

function defaultEta(order: OrderRecord) {
  const orderDate = parseDate(order.date);
  return orderDate ? addDays(orderDate, 3).toISOString().slice(0, 10) : '';
}

function daysSince(value?: string) {
  const date = parseDate(value);
  if (!date) {
    return 0;
  }
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}

function getDelayDays(order: OrderRecord) {
  const status = normalizeDeliveryStatus(order.delivery);
  if (status === 'delivered' || status === 'failed') {
    return 0;
  }
  const eta = parseDate(order.eta || defaultEta(order));
  if (!eta) {
    return 0;
  }
  return Math.max(0, Math.floor((Date.now() - eta.getTime()) / 86_400_000));
}

function getPriority(order: OrderRecord) {
  const status = normalizeDeliveryStatus(order.delivery);
  if (status === 'failed' || getDelayDays(order) > 0) {
    return 'high';
  }
  if ((status === 'pending' || status === 'not_shipped') && daysSince(order.date) >= 2) {
    return 'high';
  }
  return 'normal';
}

function nextOrderStatus(order: OrderRecord, delivery: DeliveryStatus) {
  if (delivery === 'delivered') {
    return 'delivered';
  }
  if (delivery === 'in_transit' && order.status !== 'delivered') {
    return 'shipped';
  }
  return order.status;
}

export function DeliveryPage() {
  const [orders, setOrders] = useState<OrderRecord[]>(fallbackOrders);
  const [selectedDelivery, setSelectedDelivery] = useState<OrderRecord | null>(null);
  const [draft, setDraft] = useState({
    delivery: 'pending' as DeliveryStatus,
    courier: 'none',
    tracking: '',
    eta: '',
    deliveryNotes: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;

    const loadOrders = async () => {
      try {
        const apiOrders = await fetchOrdersApi();
        if (active) {
          setOrders(apiOrders);
          setLoadError('');
        }
      } catch (_error) {
        if (active) {
          setLoadError('Impossible de charger les livraisons depuis le serveur. Donnees locales affichees.');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    loadOrders();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedDelivery) {
      return;
    }
    setDraft({
      delivery: normalizeDeliveryStatus(selectedDelivery.delivery),
      courier: selectedDelivery.courier || 'none',
      tracking: selectedDelivery.tracking || '',
      eta: toDateInputValue(selectedDelivery.eta) || defaultEta(selectedDelivery),
      deliveryNotes: selectedDelivery.deliveryNotes || '',
    });
  }, [selectedDelivery]);

  const activeDeliveries = useMemo(
    () => orders.filter((order) => normalizeDeliveryStatus(order.delivery) !== 'delivered'),
    [orders]
  );

  const metrics = useMemo(() => {
    const statusCounts = orders.reduce<Record<DeliveryStatus, number>>(
      (acc, order) => {
        const status = normalizeDeliveryStatus(order.delivery);
        acc[status] += 1;
        return acc;
      },
      { not_shipped: 0, pending: 0, in_transit: 0, delivered: 0, failed: 0 }
    );
    const delayed = activeDeliveries.filter((order) => getDelayDays(order) > 0).length;
    const waitingTooLong = activeDeliveries.filter((order) => daysSince(order.date) >= 2).length;
    const activeLoad = orders.length ? Math.round((activeDeliveries.length / orders.length) * 100) : 0;

    return {
      statusCounts,
      delayed,
      waitingTooLong,
      failed: statusCounts.failed,
      activeLoad,
    };
  }, [orders, activeDeliveries]);

  const handleSaveDelivery = async () => {
    if (!selectedDelivery) {
      return;
    }

    const patch: Partial<OrderRecord> = {
      delivery: draft.delivery,
      status: nextOrderStatus(selectedDelivery, draft.delivery),
      courier: draft.courier === 'none' ? '' : draft.courier,
      tracking: draft.tracking.trim(),
      eta: draft.eta,
      deliveryNotes: draft.deliveryNotes.trim(),
      deliveryUpdatedAt: new Date().toISOString(),
    };

    setIsSaving(true);
    try {
      const updated = await updateOrderApi(selectedDelivery.id, patch);
      setOrders((prev) => prev.map((order) => (order.id === updated.id ? updated : order)));
      setSelectedDelivery(updated);
      setLoadError('');
      toast.success('Livraison mise a jour');
    } catch (_error) {
      toast.error('Mise a jour livraison echouee');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1>Livraison</h1>
        <p className="text-muted-foreground">Gestion des operations de livraison connectee aux commandes admin</p>
      </div>

      {loadError && (
        <Card className="p-4 border-warning bg-warning/5">
          <p className="text-sm">{loadError}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard title="En attente trop longtemps" value={String(metrics.waitingTooLong)} icon={<Clock size={24} />} />
        <KPICard title="Retards d'expedition" value={String(metrics.delayed)} icon={<AlertTriangle size={24} />} />
        <KPICard title="Livraisons echouees" value={String(metrics.failed)} icon={<AlertTriangle size={24} />} />
        <KPICard title="Charge active" value={`${metrics.activeLoad}%`} icon={<Package size={24} />} />
      </div>

      <Card className="p-6">
        <h3 className="mb-4">Charge par statut</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg border">
            <p className="text-sm text-muted-foreground mb-1">En attente</p>
            <p className="text-3xl font-semibold">{metrics.statusCounts.pending + metrics.statusCounts.not_shipped}</p>
          </div>
          <div className="p-4 rounded-lg border">
            <p className="text-sm text-muted-foreground mb-1">En transit</p>
            <p className="text-3xl font-semibold">{metrics.statusCounts.in_transit}</p>
          </div>
          <div className="p-4 rounded-lg border">
            <p className="text-sm text-muted-foreground mb-1">En retard</p>
            <p className="text-3xl font-semibold text-warning">{metrics.delayed}</p>
          </div>
          <div className="p-4 rounded-lg border">
            <p className="text-sm text-muted-foreground mb-1">Livrees</p>
            <p className="text-3xl font-semibold text-green-600">{metrics.statusCounts.delivered}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4">Surveillance SLA</h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement des livraisons...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">ID</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Client</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Destination</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Statut</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Priorite</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Transporteur</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">ETA</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((delivery) => {
                  const status = normalizeDeliveryStatus(delivery.delivery);
                  const priority = getPriority(delivery);
                  const delay = getDelayDays(delivery);
                  return (
                    <tr key={delivery.id} className="border-b hover:bg-accent/50 transition-colors">
                      <td className="py-3 px-4 text-sm font-medium">{delivery.id}</td>
                      <td className="py-3 px-4 text-sm">{delivery.customer}</td>
                      <td className="py-3 px-4 text-sm">{delivery.city || delivery.address || '-'}</td>
                      <td className="py-3 px-4">
                        <StatusBadge status={deliveryStatusLabels[status]} type={deliveryStatusTypes[status]} />
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={priority === 'high' ? 'Haute' : 'Normale'} type={priority === 'high' ? 'danger' : 'info'} />
                      </td>
                      <td className="py-3 px-4 text-sm">{delivery.courier || 'Non assigne'}</td>
                      <td className="py-3 px-4 text-sm">
                        {delay > 0 && <span className="text-warning mr-2">+{delay}j</span>}
                        {formatDate(delivery.eta || defaultEta(delivery))}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setSelectedDelivery(delivery)}>
                          Intervenir
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Sheet open={!!selectedDelivery} onOpenChange={() => setSelectedDelivery(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedDelivery && (
            <>
              <SheetHeader>
                <SheetTitle>Details livraison {selectedDelivery.id}</SheetTitle>
                <SheetDescription>Modifier les details de la livraison</SheetDescription>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                <Card className="p-4">
                  <h4 className="mb-4">Informations</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Client</span>
                      <span className="font-medium text-right">{selectedDelivery.customer}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Destination</span>
                      <span className="font-medium text-right">{selectedDelivery.address || selectedDelivery.city || '-'}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Statut</span>
                      <StatusBadge
                        status={deliveryStatusLabels[normalizeDeliveryStatus(selectedDelivery.delivery)]}
                        type={deliveryStatusTypes[normalizeDeliveryStatus(selectedDelivery.delivery)]}
                      />
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <h4 className="mb-4">Mise a jour</h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Statut</Label>
                      <Select
                        value={draft.delivery}
                        onValueChange={(value) => setDraft((prev) => ({ ...prev, delivery: normalizeDeliveryStatus(value) }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not_shipped">Non expedie</SelectItem>
                          <SelectItem value="pending">En attente</SelectItem>
                          <SelectItem value="in_transit">En transit</SelectItem>
                          <SelectItem value="delivered">Livre</SelectItem>
                          <SelectItem value="failed">Echec</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Transporteur</Label>
                      <Select
                        value={draft.courier}
                        onValueChange={(value) => setDraft((prev) => ({ ...prev, courier: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Non assigne</SelectItem>
                          <SelectItem value="Aramex">Aramex</SelectItem>
                          <SelectItem value="DHL">DHL</SelectItem>
                          <SelectItem value="FedEx">FedEx</SelectItem>
                          <SelectItem value="Local">Transporteur local</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Code de suivi</Label>
                      <Input
                        value={draft.tracking}
                        placeholder="AR123456"
                        onChange={(event) => setDraft((prev) => ({ ...prev, tracking: event.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>ETA</Label>
                      <Input
                        type="date"
                        value={draft.eta}
                        onChange={(event) => setDraft((prev) => ({ ...prev, eta: event.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        placeholder="Ajouter une note..."
                        rows={3}
                        value={draft.deliveryNotes}
                        onChange={(event) => setDraft((prev) => ({ ...prev, deliveryNotes: event.target.value }))}
                      />
                    </div>

                    <Button className="w-full" onClick={() => void handleSaveDelivery()} disabled={isSaving}>
                      {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                    </Button>
                  </div>
                </Card>

                <Card className="p-4">
                  <h4 className="mb-4">Historique des mises a jour</h4>
                  <div className="space-y-3">
                    <div className="text-sm">
                      <p className="font-medium">{deliveryStatusLabels[normalizeDeliveryStatus(selectedDelivery.delivery)]}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedDelivery.deliveryUpdatedAt ? formatDate(selectedDelivery.deliveryUpdatedAt) : 'Derniere mise a jour non renseignee'}
                      </p>
                    </div>
                    <div className="text-sm">
                      <p className="font-medium">Transporteur: {selectedDelivery.courier || 'Non assigne'}</p>
                      <p className="text-xs text-muted-foreground">Suivi: {selectedDelivery.tracking || '-'}</p>
                    </div>
                    <div className="text-sm">
                      <p className="font-medium">Commande creee</p>
                      <p className="text-xs text-muted-foreground">{formatDate(selectedDelivery.date)}</p>
                    </div>
                  </div>
                </Card>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
