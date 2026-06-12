import { useEffect, useState } from 'react';
import { Search, Download, TrendingUp, DollarSign, ShoppingCart, X, Package, User, MapPin, Phone, Mail, FileText, CheckCircle2, XCircle, Edit } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../components/ui/sheet';
import { Checkbox } from '../components/ui/checkbox';
import { Textarea } from '../components/ui/textarea';
import { KPICard } from '../components/admin/KPICard';
import { EmptyState } from '../components/admin/EmptyState';
import { StatusBadge } from '../components/admin/StatusBadge';
import { AIOrderRecord, AIOrderStatus, fetchAIOrdersApi, updateAIOrderApi } from '../services/api';
import { exportToCSV } from '../utils/helpers';
import { toast } from 'sonner';

const fallbackOrders: AIOrderRecord[] = [
  {
    id: 'AI-001',
    source: 'WhatsApp',
    customer: 'Ahmed Ben Ali',
    customerEmail: 'ahmed@example.tn',
    customerPhone: '+216 98 123 456',
    customerAddress: 'Avenue Habib Bourguiba, Tunis',
    product: 'MacBook Pro 16"',
    productDescription: 'MacBook Pro 16 pouces, M3 Pro, 18 Go RAM, 512 Go SSD',
    status: 'brouillon',
    amount: 2499,
    date: '24 Mar 2026 10:30',
    confidence: 85,
  },
  {
    id: 'AI-002',
    source: 'Facebook',
    customer: 'Sara Mansouri',
    customerEmail: 'sara.m@example.tn',
    customerPhone: '+216 22 456 789',
    customerAddress: 'Rue de la Republique, Sousse',
    product: 'iPhone 15 Pro',
    productDescription: 'iPhone 15 Pro, 256 Go, Titane naturel',
    status: 'confirme',
    amount: 1299,
    date: '24 Mar 2026 09:15',
    confidence: 92,
  },
  {
    id: 'AI-003',
    source: 'Instagram',
    customer: 'Mehdi Trabelsi',
    customerPhone: '+216 55 789 012',
    customerAddress: 'Boulevard Tahar Sfar, Sfax',
    product: 'AirPods Pro',
    productDescription: 'AirPods Pro (2eme generation) avec etui de charge MagSafe',
    status: 'brouillon',
    amount: 249,
    date: '23 Mar 2026 16:45',
    confidence: 78,
  },
  {
    id: 'AI-004',
    source: 'WhatsApp',
    customer: 'Leila Hamdi',
    customerEmail: 'leila.h@example.tn',
    customerPhone: '+216 29 345 678',
    customerAddress: 'Avenue de la Corniche, Bizerte',
    product: 'iPad Air',
    productDescription: 'iPad Air 11 pouces, Wi-Fi, 256 Go',
    status: 'confirme',
    amount: 649,
    date: '23 Mar 2026 14:20',
    confidence: 88,
  },
  {
    id: 'AI-005',
    source: 'Facebook',
    customer: 'Karim Gharbi',
    customerPhone: '+216 93 567 890',
    product: 'Apple Watch',
    status: 'annule',
    amount: 0,
    date: '23 Mar 2026 11:10',
    confidence: 62,
  },
];

const statusConfig = {
  brouillon: { label: 'Brouillon', type: 'info' as const },
  confirme: { label: 'Confirme', type: 'success' as const },
  annule: { label: 'Annule', type: 'danger' as const },
};

const sourceIcons: Record<string, string> = {
  WhatsApp: '💬',
  Facebook: '📘',
  Instagram: '📷',
};

export function CommandesAIPage() {
  const [orders, setOrders] = useState<AIOrderRecord[]>(fallbackOrders);
  const [selectedOrder, setSelectedOrder] = useState<AIOrderRecord | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AIOrderStatus[]>([]);
  const [editableOrder, setEditableOrder] = useState<AIOrderRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;

    const loadOrders = async () => {
      try {
        const apiOrders = await fetchAIOrdersApi();
        if (active) {
          setOrders(apiOrders);
          setLoadError('');
        }
      } catch (_error) {
        if (active) {
          setLoadError('Impossible de charger les commandes IA depuis le serveur. Donnees locales affichees.');
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

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      searchQuery === '' ||
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.product.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(order.status);

    return matchesSearch && matchesStatus;
  });

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const toggleStatusFilter = (status: AIOrderStatus) => {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const handleOpenOrder = (order: AIOrderRecord) => {
    setSelectedOrder(order);
    setEditableOrder({ ...order });
  };

  const applyOrderUpdate = (updatedOrder: AIOrderRecord) => {
    setOrders((prev) => prev.map((entry) => (entry.id === updatedOrder.id ? updatedOrder : entry)));
    setSelectedOrder(updatedOrder);
    setEditableOrder(updatedOrder);
  };

  const handleConfirmOrder = async () => {
    if (!editableOrder) {
      return;
    }
    try {
      const updatedOrder = await updateAIOrderApi(editableOrder.id, { status: 'confirme' });
      applyOrderUpdate(updatedOrder);
      toast.success('Commande confirmee');
    } catch (_error) {
      toast.error('Impossible de confirmer la commande');
    }
  };

  const handleSendInvoice = () => {
    if (selectedOrder) {
      exportToCSV(
        [
          {
            id: selectedOrder.id,
            customer: selectedOrder.customer,
            email: selectedOrder.customerEmail || '',
            phone: selectedOrder.customerPhone || '',
            product: selectedOrder.product,
            amount: selectedOrder.amount,
            status: selectedOrder.status,
            date: selectedOrder.date,
          },
        ],
        `facture-ai-${selectedOrder.id}`
      );
      toast.success(`Facture exportee: ${selectedOrder.id}`);
    }
    setSelectedOrder(null);
    setEditableOrder(null);
  };

  const handleExportAll = () => {
    exportToCSV(filteredOrders, `commandes-ai-${new Date().toISOString().split('T')[0]}`);
    toast.success('Export des commandes IA termine');
  };

  const handleBulkConfirm = async () => {
    if (!selectedOrders.length) {
      return;
    }

    const ids = new Set(selectedOrders);
    const targets = orders.filter((order) => ids.has(order.id) && order.status !== 'confirme');

    if (!targets.length) {
      toast.info('Toutes les commandes selectionnees sont deja confirmees');
      setSelectedOrders([]);
      return;
    }

    const results = await Promise.allSettled(
      targets.map((order) => updateAIOrderApi(order.id, { status: 'confirme' }))
    );

    const succeeded = results
      .filter((result): result is PromiseFulfilledResult<AIOrderRecord> => result.status === 'fulfilled')
      .map((result) => result.value);

    if (succeeded.length) {
      setOrders((prev) => prev.map((order) => succeeded.find((updated) => updated.id === order.id) || order));
    }

    const failed = results.length - succeeded.length;
    if (failed > 0) {
      toast.error(`${failed} commande(s) n'ont pas pu etre confirmees`);
    } else {
      toast.success('Commandes confirmees');
    }

    setSelectedOrders([]);
  };

  const handleBulkInvoice = () => {
    if (!selectedOrders.length) {
      return;
    }

    const ids = new Set(selectedOrders);
    const payload = orders
      .filter((order) => ids.has(order.id))
      .map((order) => ({
        id: order.id,
        customer: order.customer,
        email: order.customerEmail || '',
        product: order.product,
        amount: order.amount,
        status: order.status,
        date: order.date,
      }));

    exportToCSV(payload, `factures-ai-selection-${new Date().toISOString().split('T')[0]}`);
    toast.success('Factures exportees pour la selection');
    setSelectedOrders([]);
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) {
      return;
    }
    try {
      const updatedOrder = await updateAIOrderApi(selectedOrder.id, { status: 'annule' });
      applyOrderUpdate(updatedOrder);
      toast.success('Commande annulee');
    } catch (_error) {
      toast.error('Impossible d annuler cette commande');
    }
  };

  const totalAIOrders = orders.length;
  const confirmedOrders = orders.filter((o) => o.status === 'confirme').length;
  const conversionRate = totalAIOrders > 0 ? (confirmedOrders / totalAIOrders) * 100 : 0;
  const totalRevenue = orders.filter((o) => o.status === 'confirme').reduce((sum, o) => sum + o.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1>Commandes IA</h1>
          <p className="text-muted-foreground">Convertissez automatiquement les conversations en commandes</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={handleExportAll}>
          <Download size={18} />
          Exporter
        </Button>
      </div>

      {loadError && (
        <Card className="p-4 border-warning bg-warning/5">
          <p className="text-sm">{loadError}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          title="Commandes IA generees"
          value={totalAIOrders.toString()}
          icon={<ShoppingCart size={24} />}
          trend={{ value: 12, isPositive: true }}
          subtitle="ce mois-ci"
        />
        <KPICard
          title="Taux de conversion"
          value={`${conversionRate.toFixed(1)}%`}
          icon={<TrendingUp size={24} />}
          trend={{ value: 5, isPositive: true }}
          subtitle="des conversations"
        />
        <KPICard
          title="Revenus IA"
          value={`${totalRevenue.toLocaleString()} EUR`}
          icon={<DollarSign size={24} />}
          trend={{ value: 18, isPositive: true }}
          subtitle="ce mois-ci"
        />
      </div>

      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Rechercher par ID, client ou produit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-sm text-muted-foreground hidden md:inline">Statut:</span>
            {(['brouillon', 'confirme', 'annule'] as AIOrderStatus[]).map((status) => (
              <Badge
                key={status}
                variant={statusFilter.includes(status) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => toggleStatusFilter(status)}
              >
                {statusConfig[status].label}
              </Badge>
            ))}
          </div>
        </div>
      </Card>

      {selectedOrders.length > 0 && (
        <Card className="p-4 bg-primary/5 border-primary">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">
                {selectedOrders.length} commande{selectedOrders.length > 1 ? 's' : ''} selectionnee{selectedOrders.length > 1 ? 's' : ''}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="default" onClick={() => void handleBulkConfirm()}>
                  <CheckCircle2 size={16} className="mr-2" />
                  Confirmer
                </Button>
                <Button size="sm" variant="outline" onClick={handleBulkInvoice}>
                  <FileText size={16} className="mr-2" />
                  Envoyer factures
                </Button>
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSelectedOrders([])}>
              <X size={16} />
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Chargement des commandes IA...</p>
        </Card>
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart size={48} />}
          title="Aucune commande trouvee"
          description="Les commandes generees par l'IA apparaitront ici"
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left p-4">
                    <Checkbox
                      checked={selectedOrders.length > 0 && selectedOrders.length === filteredOrders.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedOrders(filteredOrders.map((o) => o.id));
                        } else {
                          setSelectedOrders([]);
                        }
                      }}
                    />
                  </th>
                  <th className="text-left p-4 text-sm font-medium">Source</th>
                  <th className="text-left p-4 text-sm font-medium">Client</th>
                  <th className="text-left p-4 text-sm font-medium">Produit detecte</th>
                  <th className="text-left p-4 text-sm font-medium">Statut</th>
                  <th className="text-left p-4 text-sm font-medium">Total</th>
                  <th className="text-left p-4 text-sm font-medium">Date</th>
                  <th className="text-left p-4 text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="p-4">
                      <Checkbox
                        checked={selectedOrders.includes(order.id)}
                        onCheckedChange={() => toggleOrderSelection(order.id)}
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{sourceIcons[order.source] || '💬'}</span>
                        <span className="text-sm">{order.source}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium">{order.customer}</div>
                      <div className="text-sm text-muted-foreground">{order.id}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{order.product}</span>
                        <Badge variant="secondary" className="text-xs">
                          IA
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Confiance: {order.confidence}%</div>
                    </td>
                    <td className="p-4">
                      <StatusBadge status={statusConfig[order.status].label} type={statusConfig[order.status].type} />
                    </td>
                    <td className="p-4">
                      <span className="font-medium">{order.amount.toLocaleString()} EUR</span>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{order.date}</td>
                    <td className="p-4">
                      <Button size="sm" variant="ghost" onClick={() => handleOpenOrder(order)}>
                        Voir details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Sheet open={selectedOrder !== null} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedOrder && editableOrder && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  Commande {selectedOrder.id}
                  <Badge variant="secondary" className="text-xs">
                    Genere par IA
                  </Badge>
                </SheetTitle>
                <SheetDescription>Details et edition de la commande</SheetDescription>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium block mb-2">Statut</label>
                    <StatusBadge status={statusConfig[selectedOrder.status].label} type={statusConfig[selectedOrder.status].type} />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-2">Confiance IA</label>
                    <div className="text-2xl font-bold">{selectedOrder.confidence}%</div>
                  </div>
                </div>

                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{sourceIcons[selectedOrder.source] || '💬'}</span>
                    <div>
                      <div className="font-medium">{selectedOrder.source}</div>
                      <div className="text-sm text-muted-foreground">{selectedOrder.date}</div>
                    </div>
                  </div>
                </Card>

                <div>
                  <label className="text-sm font-medium block mb-3">Informations client</label>
                  <Card className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <User size={16} className="text-muted-foreground" />
                      <Input
                        value={editableOrder.customer}
                        onChange={(e) => setEditableOrder({ ...editableOrder, customer: e.target.value })}
                      />
                    </div>

                    {editableOrder.customerPhone && (
                      <div className="flex items-center gap-3">
                        <Phone size={16} className="text-muted-foreground" />
                        <Input
                          value={editableOrder.customerPhone}
                          onChange={(e) => setEditableOrder({ ...editableOrder, customerPhone: e.target.value })}
                        />
                      </div>
                    )}

                    {editableOrder.customerEmail && (
                      <div className="flex items-center gap-3">
                        <Mail size={16} className="text-muted-foreground" />
                        <Input
                          value={editableOrder.customerEmail}
                          onChange={(e) => setEditableOrder({ ...editableOrder, customerEmail: e.target.value })}
                        />
                      </div>
                    )}

                    {editableOrder.customerAddress && (
                      <div className="flex items-start gap-3">
                        <MapPin size={16} className="text-muted-foreground mt-3" />
                        <Textarea
                          value={editableOrder.customerAddress}
                          onChange={(e) => setEditableOrder({ ...editableOrder, customerAddress: e.target.value })}
                          rows={2}
                        />
                      </div>
                    )}
                  </Card>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-3">Produit</label>
                  <Card className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <Package size={16} className="text-muted-foreground" />
                      <Input
                        value={editableOrder.product}
                        onChange={(e) => setEditableOrder({ ...editableOrder, product: e.target.value })}
                      />
                    </div>

                    {editableOrder.productDescription && (
                      <Textarea
                        value={editableOrder.productDescription}
                        onChange={(e) => setEditableOrder({ ...editableOrder, productDescription: e.target.value })}
                        rows={2}
                        placeholder="Description du produit"
                      />
                    )}

                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-sm font-medium">Montant total</span>
                      <span className="text-xl font-bold">{editableOrder.amount.toLocaleString()} EUR</span>
                    </div>
                  </Card>
                </div>

                <div className="flex flex-col gap-2 pt-4">
                  {selectedOrder.status === 'brouillon' && (
                    <Button className="w-full gap-2" onClick={() => void handleConfirmOrder()}>
                      <CheckCircle2 size={16} />
                      Confirmer commande
                    </Button>
                  )}

                  {selectedOrder.status === 'confirme' && (
                    <Button className="w-full gap-2" onClick={handleSendInvoice}>
                      <FileText size={16} />
                      Envoyer facture
                    </Button>
                  )}

                  <Button variant="outline" className="w-full gap-2" onClick={() => toast.info('Ouverture CRM disponible depuis le module Clients')}>
                    <Edit size={16} />
                    Modifier dans CRM
                  </Button>

                  {selectedOrder.status !== 'annule' && (
                    <Button variant="destructive" className="w-full gap-2" onClick={() => void handleCancelOrder()}>
                      <XCircle size={16} />
                      Annuler commande
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
