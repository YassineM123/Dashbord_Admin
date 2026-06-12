import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Search, Filter, Download, X, Package, User, Mail, Phone, MapPin, CreditCard, FileText } from 'lucide-react';
import { StatusBadge } from '../components/admin/StatusBadge';
import { EmptyState } from '../components/admin/EmptyState';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../components/ui/sheet';
import { Checkbox } from '../components/ui/checkbox';
import { Badge } from '../components/ui/badge';
import { exportToCSV } from '../utils/helpers';
import { fetchOrdersApi, OrderRecord, updateOrderApi } from '../services/api';
import { toast } from 'sonner';
import { SimpleManualOrderSheet } from '../components/orders/SimpleManualOrderSheet';

const fallbackOrders: OrderRecord[] = [
  { id: '#10245', customer: 'Jean Dupont', email: 'jean@example.com', status: 'paid', payment: 'CB', delivery: 'pending', amount: 156, date: '3 Mar 2026 14:23', city: 'Tunis', address: '123 Avenue Habib Bourguiba, Tunis' },
  { id: '#10244', customer: 'Marie Martin', email: 'marie@example.com', status: 'shipped', payment: 'CB', delivery: 'in_transit', amount: 289, date: '3 Mar 2026 10:15', city: 'Sousse', address: 'Rue de la Republique, Sousse' },
  { id: '#10243', customer: 'Pierre Durand', email: 'pierre@example.com', status: 'delivered', payment: 'COD', delivery: 'delivered', amount: 543, date: '2 Mar 2026 16:42', city: 'Sfax', address: 'Boulevard Tahar Sfar, Sfax' },
  { id: '#10242', customer: 'Sophie Bernard', email: 'sophie@example.com', status: 'pending', payment: 'Pending', delivery: 'not_shipped', amount: 98, date: '2 Mar 2026 09:18', city: 'Nabeul', address: 'Avenue Habib Thameur, Nabeul' },
  { id: '#10241', customer: 'Luc Petit', email: 'luc@example.com', status: 'paid', payment: 'CB', delivery: 'pending', amount: 234, date: '2 Mar 2026 08:05', city: 'Bizerte', address: 'Avenue de la Corniche, Bizerte' },
];

const orderProducts = [
  { name: 'MacBook Pro 16"', quantity: 1, price: 2499, image: '📦' },
  { name: 'Magic Mouse', quantity: 2, price: 99, image: '📦' },
];

const statusChoices = ['pending', 'paid', 'shipped', 'delivered', 'canceled'];

export function OrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRecord[]>(fallbackOrders);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [orderNotes, setOrderNotes] = useState<Record<string, string>>({});
  const [noteDraft, setNoteDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isManualOrderOpen, setIsManualOrderOpen] = useState(false);

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
          setLoadError('Impossible de charger les commandes depuis le serveur. Donnees locales affichees.');
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
    if (!selectedOrder) {
      setNoteDraft('');
      return;
    }
    setNoteDraft(orderNotes[selectedOrder.id] || '');
  }, [selectedOrder, orderNotes]);

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(order.status);
    return matchesSearch && matchesStatus;
  });

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const toggleStatusFilter = (status: string) => {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const handleExportAll = () => {
    exportToCSV(filteredOrders, `commandes-${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportSelected = () => {
    const selected = orders.filter((order) => selectedOrders.includes(order.id));
    exportToCSV(selected, `commandes-selection-${new Date().toISOString().split('T')[0]}`);
  };

  const handleMarkSelectedAsShipped = async () => {
    if (!selectedOrders.length) {
      return;
    }

    const targetIds = new Set(selectedOrders);
    const previousOrders = orders;
    const nextOrders = orders.map((order) =>
      targetIds.has(order.id)
        ? { ...order, status: 'shipped', delivery: order.delivery === 'delivered' ? 'delivered' : 'in_transit' }
        : order
    );

    setOrders(nextOrders);
    setSelectedOrders([]);

    const updates = previousOrders
      .filter((order) => targetIds.has(order.id))
      .map((order) =>
        updateOrderApi(order.id, {
          status: 'shipped',
          delivery: order.delivery === 'delivered' ? 'delivered' : 'in_transit',
        })
      );

    const results = await Promise.allSettled(updates);
    const failed = results.filter((result) => result.status === 'rejected').length;

    if (failed > 0) {
      setOrders(previousOrders);
      setLoadError('Impossible de mettre a jour certaines commandes. Les changements ont ete annules.');
      toast.error('Mise a jour echouee');
      return;
    }

    setLoadError('');
    toast.success('Commandes marquees comme expediees');
  };

  const handleDownloadInvoice = () => {
    if (!selectedOrder) {
      return;
    }

    exportToCSV(
      [
        {
          id: selectedOrder.id,
          customer: selectedOrder.customer,
          email: selectedOrder.email,
          payment: selectedOrder.payment,
          delivery: selectedOrder.delivery,
          amount: selectedOrder.amount,
          date: selectedOrder.date,
        },
      ],
      `facture-${selectedOrder.id.replace('#', '')}`
    );
    toast.success(`Facture exportee: ${selectedOrder.id}`);
  };

  const handleSaveInternalNote = () => {
    if (!selectedOrder) {
      return;
    }
    setOrderNotes((prev) => ({ ...prev, [selectedOrder.id]: noteDraft.trim() }));
    toast.success('Note enregistree');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1>Commandes</h1>
        <p className="text-muted-foreground">Gerez toutes vos commandes</p>
      </div>

      <div className="flex justify-end">
        <Button className="gap-2" onClick={() => setIsManualOrderOpen(true)}>
          <FileText size={16} />
          New Manual Order
        </Button>
      </div>

      {loadError && (
        <Card className="p-4 border-warning bg-warning/5">
          <p className="text-sm">{loadError}</p>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Rechercher par ID ou client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.info('Utilisez la recherche et les statuts pour filtrer les commandes')}>
              <Filter size={16} />
              Filtres
            </Button>
            {statusChoices.map((status) => (
              <Badge
                key={status}
                variant={statusFilter.includes(status) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => toggleStatusFilter(status)}
              >
                {status}
              </Badge>
            ))}
            {statusFilter.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setStatusFilter([])}>
                Effacer
              </Button>
            )}
          </div>

          <Button variant="outline" className="gap-2" onClick={handleExportAll}>
            <Download size={16} />
            Exporter
          </Button>
        </div>
      </Card>

      {selectedOrders.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{selectedOrders.length} commande(s) selectionnee(s)</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void handleMarkSelectedAsShipped()}>Marquer expediees</Button>
              <Button variant="outline" size="sm" onClick={handleExportSelected}>Exporter selection</Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedOrders([])}>
                Deselectionner
              </Button>
            </div>
          </div>
        </Card>
      )}

      {isLoading ? (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Chargement des commandes...</p>
        </Card>
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          icon={<Package size={40} />}
          title="Aucune commande trouvee"
          description="Aucune commande ne correspond aux filtres appliques."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-card border-b">
                <tr>
                  <th className="py-3 px-4">
                    <Checkbox
                      checked={selectedOrders.length > 0 && selectedOrders.length === filteredOrders.length}
                      onCheckedChange={(checked) => {
                        setSelectedOrders(checked ? filteredOrders.map((o) => o.id) : []);
                      }}
                    />
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">ID</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Client</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Statut</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Paiement</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Livraison</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b hover:bg-accent/50 transition-colors">
                    <td className="py-3 px-4">
                      <Checkbox
                        checked={selectedOrders.includes(order.id)}
                        onCheckedChange={() => toggleOrderSelection(order.id)}
                      />
                    </td>
                    <td className="py-3 px-4 text-sm font-medium">{order.id}</td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-sm font-medium">{order.customer}</p>
                        <p className="text-xs text-muted-foreground">{order.email}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge
                        status={
                          order.status === 'paid'
                            ? 'Paye'
                            : order.status === 'shipped'
                              ? 'Expedie'
                              : order.status === 'delivered'
                                ? 'Livre'
                                : order.status === 'canceled'
                                  ? 'Annule'
                                  : 'En attente'
                        }
                        type={order.status as any}
                      />
                    </td>
                    <td className="py-3 px-4 text-sm">{order.payment}</td>
                    <td className="py-3 px-4">
                      <StatusBadge
                        status={
                          order.delivery === 'delivered'
                            ? 'Livre'
                            : order.delivery === 'in_transit'
                              ? 'En transit'
                              : order.delivery === 'pending'
                                ? 'En attente'
                                : 'Non expedie'
                        }
                        type={order.delivery === 'delivered' ? 'success' : order.delivery === 'in_transit' ? 'info' : 'warning'}
                      />
                    </td>
                    <td className="py-3 px-4 text-sm text-right font-medium">EUR {order.amount}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{order.date}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setSelectedOrder(order)}>
                          Apercu
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => navigate(`/admin/orders/${encodeURIComponent(order.id)}`)}>
                          Details
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Sheet open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedOrder && (
            <>
              <SheetHeader>
                <SheetTitle>Details de la commande {selectedOrder.id}</SheetTitle>
                <SheetDescription>Informations detaillees sur la commande</SheetDescription>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                <Card className="p-4">
                  <h4 className="mb-3 flex items-center gap-2">
                    <User size={18} />
                    Informations client
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-muted-foreground" />
                      <span>{selectedOrder.customer}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail size={14} className="text-muted-foreground" />
                      <span>{selectedOrder.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone size={14} className="text-muted-foreground" />
                      <span>+216 XX XXX XXX</span>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <h4 className="mb-3 flex items-center gap-2">
                    <MapPin size={18} />
                    Adresse de livraison
                  </h4>
                  <p className="text-sm">
                    {selectedOrder.address || 'Adresse non renseignee'}
                    <br />
                    {selectedOrder.city ? `${selectedOrder.city}, Tunisie` : 'Tunisie'}
                  </p>
                  <div className="mt-4">
                    <label className="text-sm font-medium mb-2 block">Statut de livraison</label>
                    <StatusBadge
                      status={
                        selectedOrder.delivery === 'delivered'
                          ? 'Livre'
                          : selectedOrder.delivery === 'in_transit'
                            ? 'En transit'
                            : 'En attente'
                      }
                      type={selectedOrder.delivery === 'delivered' ? 'delivered' : selectedOrder.delivery === 'in_transit' ? 'shipped' : 'pending'}
                    />
                  </div>
                </Card>

                <Card className="p-4">
                  <h4 className="mb-3 flex items-center gap-2">
                    <Package size={18} />
                    Produits commandes
                  </h4>
                  <div className="space-y-3">
                    {orderProducts.map((product, index) => (
                      <div key={index} className="flex items-center gap-3 pb-3 border-b last:border-0">
                        <div className="h-12 w-12 bg-muted rounded flex items-center justify-center text-2xl">
                          {product.image}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">Quantite: {product.quantity}</p>
                        </div>
                        <p className="text-sm font-medium">EUR {product.price}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex justify-between text-sm mb-2">
                      <span>Sous-total</span>
                      <span>EUR {selectedOrder.amount - 10}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Livraison</span>
                      <span>EUR 10</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span>EUR {selectedOrder.amount}</span>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <h4 className="mb-3 flex items-center gap-2">
                    <CreditCard size={18} />
                    Paiement & Facture
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Methode</span>
                      <span className="font-medium">{selectedOrder.payment}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Statut</span>
                      <StatusBadge status="Paye" type="success" />
                    </div>
                    <Button variant="outline" className="w-full gap-2 mt-2" onClick={handleDownloadInvoice}>
                      <FileText size={16} />
                      Telecharger facture
                    </Button>
                  </div>
                </Card>

                <Card className="p-4">
                  <h4 className="mb-3">Notes internes</h4>
                  <textarea
                    className="w-full min-h-24 p-3 rounded-md border bg-background resize-none text-sm"
                    placeholder="Ajouter une note..."
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                  />
                  <Button size="sm" className="mt-2" onClick={handleSaveInternalNote}>Enregistrer</Button>
                </Card>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <SimpleManualOrderSheet open={isManualOrderOpen} onOpenChange={setIsManualOrderOpen} />
    </div>
  );
}
