import { useEffect, useState } from 'react';
import { Search, Download, User, Mail, Phone, Ban, Trash2 } from 'lucide-react';
import { StatusBadge } from '../components/admin/StatusBadge';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { deleteCustomerApi, fetchCustomersApi, CustomerRecord, updateCustomerApi } from '../services/api';
import { exportToCSV } from '../utils/helpers';
import { toast } from 'sonner';

const fallbackCustomers: CustomerRecord[] = [
  { id: '1', name: 'Jean Dupont', email: 'jean@example.com', phone: '+216 XX XXX XXX', status: 'active', orders: 12, totalSpent: 1840, lastActivity: '3 Mar 2026' },
  { id: '2', name: 'Marie Martin', email: 'marie@example.com', phone: '+216 XX XXX XXX', status: 'active', orders: 8, totalSpent: 1245, lastActivity: '2 Mar 2026' },
  { id: '3', name: 'Pierre Durand', email: 'pierre@example.com', phone: '+216 XX XXX XXX', status: 'active', orders: 23, totalSpent: 4521, lastActivity: '1 Mar 2026' },
  { id: '4', name: 'Sophie Bernard', email: 'sophie@example.com', phone: '+216 XX XXX XXX', status: 'blocked', orders: 3, totalSpent: 234, lastActivity: '28 Fev 2026' },
  { id: '5', name: 'Luc Petit', email: 'luc@example.com', phone: '+216 XX XXX XXX', status: 'active', orders: 15, totalSpent: 2890, lastActivity: '3 Mar 2026' },
];

const customerOrders = [
  { id: '#10245', date: '3 Mar 2026', status: 'delivered', amount: 156 },
  { id: '#10198', date: '15 Fev 2026', status: 'delivered', amount: 289 },
  { id: '#10145', date: '28 Jan 2026', status: 'delivered', amount: 543 },
];

export function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRecord[]>(fallbackCustomers);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [customerNotes, setCustomerNotes] = useState<Record<string, string>>({});
  const [notesDraft, setNotesDraft] = useState('');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;

    const loadCustomers = async () => {
      try {
        const apiCustomers = await fetchCustomersApi();
        if (active) {
          setCustomers(apiCustomers);
          setLoadError('');
        }
      } catch (_error) {
        if (active) {
          setLoadError('Impossible de charger les clients depuis le serveur. Donnees locales affichees.');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    loadCustomers();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedCustomer) {
      setNotesDraft('');
      return;
    }
    setNotesDraft(customerNotes[selectedCustomer.id] || '');
  }, [selectedCustomer, customerNotes]);

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExportCustomers = () => {
    exportToCSV(filteredCustomers, `clients-${new Date().toISOString().split('T')[0]}`);
    toast.success('Export CSV des clients termine');
    setExportDialogOpen(false);
  };

  const handleToggleCustomerStatus = async (customer: CustomerRecord) => {
    const nextStatus = customer.status === 'active' ? 'blocked' : 'active';
    const previousCustomers = customers;
    const previousSelected = selectedCustomer;

    setCustomers((prev) => prev.map((entry) => (entry.id === customer.id ? { ...entry, status: nextStatus } : entry)));
    setSelectedCustomer((prev) => (prev && prev.id === customer.id ? { ...prev, status: nextStatus } : prev));

    try {
      await updateCustomerApi(customer.id, { status: nextStatus });
      toast.success(nextStatus === 'active' ? 'Client debloque' : 'Client bloque');
    } catch (_error) {
      setCustomers(previousCustomers);
      setSelectedCustomer(previousSelected);
      toast.error('Impossible de mettre a jour ce client');
    }
  };

  const handleDeleteCustomer = async (customer: CustomerRecord) => {
    const previousCustomers = customers;

    setCustomers((prev) => prev.filter((entry) => entry.id !== customer.id));
    setSelectedCustomer(null);

    try {
      await deleteCustomerApi(customer.id);
      toast.success('Client supprime');
    } catch (_error) {
      setCustomers(previousCustomers);
      toast.error('Suppression impossible');
    }
  };

  const handleSaveNotes = () => {
    if (!selectedCustomer) {
      return;
    }
    setCustomerNotes((prev) => ({ ...prev, [selectedCustomer.id]: notesDraft.trim() }));
    toast.success('Notes client enregistrees');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1>Clients</h1>
          <p className="text-muted-foreground">Gerez votre base de clients</p>
        </div>
        <Button onClick={() => setExportDialogOpen(true)} variant="outline" className="gap-2">
          <Download size={16} />
          Exporter CSV
        </Button>
      </div>

      {loadError && (
        <Card className="p-4 border-warning bg-warning/5">
          <p className="text-sm">{loadError}</p>
        </Card>
      )}

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            placeholder="Rechercher par nom ou email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      {isLoading ? (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Chargement des clients...</p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Client</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Email/Tel</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Statut</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Commandes</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Depense totale</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Derniere activite</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="border-b hover:bg-accent/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User size={18} />
                        </div>
                        <p className="text-sm font-medium">{customer.name}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <p className="text-sm flex items-center gap-2">
                          <Mail size={14} className="text-muted-foreground" />
                          {customer.email}
                        </p>
                        <p className="text-sm flex items-center gap-2">
                          <Phone size={14} className="text-muted-foreground" />
                          {customer.phone}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge
                        status={customer.status === 'active' ? 'Actif' : 'Bloque'}
                        type={customer.status === 'active' ? 'success' : 'danger'}
                      />
                    </td>
                    <td className="py-3 px-4 text-sm text-right">{customer.orders}</td>
                    <td className="py-3 px-4 text-sm text-right font-medium">EUR {customer.totalSpent}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{customer.lastActivity}</td>
                    <td className="py-3 px-4 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setSelectedCustomer(customer)}>
                        Voir profil
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedCustomer && (
            <>
              <DialogHeader>
                <DialogTitle>Profil client</DialogTitle>
                <DialogDescription>Consultez et modifiez les informations du client.</DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="details" className="mt-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="orders">Commandes ({customerOrders.length})</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4 mt-4">
                  <Card className="p-4">
                    <h4 className="mb-4">Informations personnelles</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-3">
                        <User size={16} className="text-muted-foreground" />
                        <span className="font-medium">{selectedCustomer.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Mail size={16} className="text-muted-foreground" />
                        <span>{selectedCustomer.email}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone size={16} className="text-muted-foreground" />
                        <span>{selectedCustomer.phone}</span>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <h4 className="mb-4">Statistiques</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total commandes</p>
                        <p className="text-2xl font-semibold">{selectedCustomer.orders}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Depense totale</p>
                        <p className="text-2xl font-semibold">EUR {selectedCustomer.totalSpent}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Panier moyen</p>
                        <p className="text-2xl font-semibold">EUR {Math.round(selectedCustomer.totalSpent / selectedCustomer.orders)}</p>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <h4 className="mb-4">Actions</h4>
                    <div className="flex gap-2">
                      <Button variant="outline" className="gap-2" onClick={() => void handleToggleCustomerStatus(selectedCustomer)}>
                        <Ban size={16} />
                        {selectedCustomer.status === 'active' ? 'Bloquer' : 'Debloquer'}
                      </Button>
                      <Button variant="outline" className="gap-2 text-destructive" onClick={() => void handleDeleteCustomer(selectedCustomer)}>
                        <Trash2 size={16} />
                        Supprimer
                      </Button>
                    </div>
                  </Card>
                </TabsContent>

                <TabsContent value="orders" className="mt-4">
                  <Card>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="border-b">
                          <tr>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">ID</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Statut</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Montant</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customerOrders.map((order) => (
                            <tr key={order.id} className="border-b hover:bg-accent/50">
                              <td className="py-3 px-4 text-sm font-medium">{order.id}</td>
                              <td className="py-3 px-4 text-sm">{order.date}</td>
                              <td className="py-3 px-4">
                                <StatusBadge status="Livre" type="delivered" />
                              </td>
                              <td className="py-3 px-4 text-sm text-right font-medium">EUR {order.amount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </TabsContent>

                <TabsContent value="notes" className="mt-4">
                  <Card className="p-4">
                    <textarea
                      className="w-full min-h-48 p-3 rounded-md border bg-background resize-none text-sm"
                      placeholder="Ajouter des notes sur ce client..."
                      value={notesDraft}
                      onChange={(event) => setNotesDraft(event.target.value)}
                    />
                    <Button size="sm" className="mt-3" onClick={handleSaveNotes}>Enregistrer</Button>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exporter les clients</DialogTitle>
            <DialogDescription>Choisissez la portee de l'exportation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Portee d'export</label>
              <Select defaultValue="all">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les clients</SelectItem>
                  <SelectItem value="current">Page actuelle uniquement</SelectItem>
                  <SelectItem value="filtered">Resultats filtres</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleExportCustomers}>Exporter</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
