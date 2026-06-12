import { useState } from 'react';
import { 
  Home, Package, Users, TrendingUp, Bell, Search, Moon, 
  Sun, ChevronDown, Menu, X, AlertCircle, CheckCircle2 
} from 'lucide-react';
import { KPICard } from '../components/admin/KPICard';
import { StatusBadge } from '../components/admin/StatusBadge';
import { EmptyState } from '../components/admin/EmptyState';
import { ErrorState } from '../components/admin/ErrorState';
import { RoleSwitcher } from '../components/admin/RoleSwitcher';
import { DatePresetFilter, DatePreset } from '../components/admin/DatePresetFilter';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Checkbox } from '../components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const mockChartData = [
  { name: 'Lun', value: 400 },
  { name: 'Mar', value: 300 },
  { name: 'Mer', value: 600 },
  { name: 'Jeu', value: 800 },
  { name: 'Ven', value: 500 },
];

export function ComponentInventoryPage() {
  const [datePreset, setDatePreset] = useState<DatePreset>('30j');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="space-y-12 pb-16">
      <div>
        <h1>Inventaire des composants</h1>
        <p className="text-muted-foreground">Bibliothèque complète du système de design admin</p>
      </div>

      {/* Layout Components */}
      <section className="space-y-6">
        <div>
          <h2>Layout & Navigation</h2>
          <p className="text-sm text-muted-foreground">Composants de structure principale</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="mb-4">Sidebar (Navigation)</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-primary text-primary-foreground">
                <Home size={18} />
                <span className="text-sm font-medium">Accueil (Actif)</span>
              </div>
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-accent">
                <Package size={18} />
                <span className="text-sm font-medium">Produits</span>
              </div>
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-accent">
                <Users size={18} />
                <span className="text-sm font-medium">Clients</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="mb-4">Topbar Tools</h3>
            <div className="space-y-4">
              <div>
                <Label className="text-xs mb-2">Global Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input placeholder="Rechercher..." className="pl-10" />
                </div>
              </div>
              <div>
                <Label className="text-xs mb-2">Date Preset Filter</Label>
                <DatePresetFilter value={datePreset} onChange={setDatePreset} className="w-full" />
              </div>
              <div>
                <Label className="text-xs mb-2">Role Switcher</Label>
                <RoleSwitcher />
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* KPI Cards */}
      <section className="space-y-6">
        <div>
          <h2>KPI Cards</h2>
          <p className="text-sm text-muted-foreground">Cartes de métriques avec états de chargement</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard
            title="Revenu total"
            value="€157,340"
            change={12.5}
            trend="up"
            icon={<TrendingUp size={24} />}
          />
          <KPICard
            title="Commandes"
            value="1,234"
            change={-3.4}
            trend="down"
            icon={<Package size={24} />}
          />
          <KPICard
            title="Clients actifs"
            value="847"
            icon={<Users size={24} />}
          />
          <KPICard
            title="En chargement"
            value="0"
            loading={true}
          />
        </div>
      </section>

      {/* Status Badges */}
      <section className="space-y-6">
        <div>
          <h2>Status Badges</h2>
          <p className="text-sm text-muted-foreground">Badges de statut pour commandes, produits, clients</p>
        </div>
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <Label className="text-xs mb-2 block">Order Status</Label>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status="En attente" type="pending" />
                <StatusBadge status="Payé" type="paid" />
                <StatusBadge status="Expédié" type="shipped" />
                <StatusBadge status="Livré" type="delivered" />
                <StatusBadge status="Annulé" type="canceled" />
                <StatusBadge status="Remboursé" type="refunded" />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-2 block">General Status</Label>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status="Succès" type="success" />
                <StatusBadge status="Attention" type="warning" />
                <StatusBadge status="Erreur" type="danger" />
                <StatusBadge status="Info" type="info" />
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* Tables */}
      <section className="space-y-6">
        <div>
          <h2>Tables</h2>
          <p className="text-sm text-muted-foreground">Tableaux avec filtres, tri, pagination et actions en masse</p>
        </div>
        <Card>
          <div className="p-4 border-b">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input placeholder="Rechercher..." className="pl-10" />
              </div>
              <Button variant="outline">Filtres</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="py-3 px-4">
                    <Checkbox />
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">ID</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Client</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Statut</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Montant</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b hover:bg-accent/50">
                  <td className="py-3 px-4"><Checkbox /></td>
                  <td className="py-3 px-4 text-sm font-medium">#10245</td>
                  <td className="py-3 px-4 text-sm">Jean Dupont</td>
                  <td className="py-3 px-4"><StatusBadge status="Payé" type="paid" /></td>
                  <td className="py-3 px-4 text-sm text-right font-medium">€156</td>
                  <td className="py-3 px-4 text-right">
                    <Button size="sm" variant="ghost">Voir</Button>
                  </td>
                </tr>
                <tr className="border-b hover:bg-accent/50">
                  <td className="py-3 px-4"><Checkbox /></td>
                  <td className="py-3 px-4 text-sm font-medium">#10244</td>
                  <td className="py-3 px-4 text-sm">Marie Martin</td>
                  <td className="py-3 px-4"><StatusBadge status="Expédié" type="shipped" /></td>
                  <td className="py-3 px-4 text-sm text-right font-medium">€289</td>
                  <td className="py-3 px-4 text-right">
                    <Button size="sm" variant="ghost">Voir</Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* Charts */}
      <section className="space-y-6">
        <div>
          <h2>Charts</h2>
          <p className="text-sm text-muted-foreground">Graphiques interactifs (recharts)</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="mb-4">Line Chart</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={mockChartData}>
                <CartesianGrid key="grid-comp-line" strokeDasharray="3 3" className="stroke-muted" />
                <XAxis key="xaxis-comp-line" dataKey="name" className="text-xs" />
                <YAxis key="yaxis-comp-line" className="text-xs" />
                <Tooltip key="tooltip-comp-line" />
                <Line key="line-comp" type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h3 className="mb-4">Bar Chart</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={mockChartData}>
                <CartesianGrid key="grid-comp-bar" strokeDasharray="3 3" className="stroke-muted" />
                <XAxis key="xaxis-comp-bar" dataKey="name" className="text-xs" />
                <YAxis key="yaxis-comp-bar" className="text-xs" />
                <Tooltip key="tooltip-comp-bar" />
                <Bar key="bar-comp" dataKey="value" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </section>

      {/* Forms */}
      <section className="space-y-6">
        <div>
          <h2>Form Elements</h2>
          <p className="text-sm text-muted-foreground">Inputs, selects, switches, checkboxes</p>
        </div>
        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="text-input">Text Input</Label>
              <Input id="text-input" placeholder="Entrez du texte..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="select">Select</Label>
              <Select>
                <SelectTrigger id="select">
                  <SelectValue placeholder="Choisir..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Option 1</SelectItem>
                  <SelectItem value="2">Option 2</SelectItem>
                  <SelectItem value="3">Option 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="switch-demo" />
              <Label htmlFor="switch-demo">Toggle Switch</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="checkbox-demo" />
              <Label htmlFor="checkbox-demo">Checkbox</Label>
            </div>
          </div>
        </Card>
      </section>

      {/* Modals & Drawers */}
      <section className="space-y-6">
        <div>
          <h2>Modals & Drawers</h2>
          <p className="text-sm text-muted-foreground">Dialogues et panneaux latéraux</p>
        </div>
        <Card className="p-6">
          <div className="flex gap-4">
            <Button onClick={() => setDialogOpen(true)}>Ouvrir Dialog</Button>
            <Button onClick={() => setSheetOpen(true)} variant="outline">Ouvrir Drawer</Button>
          </div>
        </Card>
      </section>

      {/* States */}
      <section className="space-y-6">
        <div>
          <h2>States</h2>
          <p className="text-sm text-muted-foreground">États vides, erreurs, chargement</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <EmptyState
              icon={<Package size={48} />}
              title="Aucun produit"
              description="Vous n'avez pas encore ajouté de produits à votre catalogue"
              action={<Button>Ajouter un produit</Button>}
            />
          </Card>
          <Card>
            <ErrorState
              title="Erreur de chargement"
              message="Impossible de charger les données"
              onRetry={() => alert('Retry clicked')}
            />
          </Card>
        </div>
      </section>

      {/* Buttons & Badges */}
      <section className="space-y-6">
        <div>
          <h2>Buttons & Badges</h2>
          <p className="text-sm text-muted-foreground">Variantes de boutons et badges</p>
        </div>
        <Card className="p-6">
          <div className="space-y-6">
            <div>
              <Label className="text-xs mb-2 block">Button Variants</Label>
              <div className="flex flex-wrap gap-2">
                <Button>Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
              </div>
            </div>
            <div>
              <Label className="text-xs mb-2 block">Button Sizes</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm">Small</Button>
                <Button>Default</Button>
                <Button size="lg">Large</Button>
              </div>
            </div>
            <div>
              <Label className="text-xs mb-2 block">Badges</Label>
              <div className="flex flex-wrap gap-2">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Destructive</Badge>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* Tabs */}
      <section className="space-y-6">
        <div>
          <h2>Tabs</h2>
          <p className="text-sm text-muted-foreground">Navigation par onglets</p>
        </div>
        <Card className="p-6">
          <Tabs defaultValue="tab1">
            <TabsList>
              <TabsTrigger value="tab1">Onglet 1</TabsTrigger>
              <TabsTrigger value="tab2">Onglet 2</TabsTrigger>
              <TabsTrigger value="tab3">Onglet 3</TabsTrigger>
            </TabsList>
            <TabsContent value="tab1" className="mt-4">
              <p className="text-sm text-muted-foreground">Contenu de l'onglet 1</p>
            </TabsContent>
            <TabsContent value="tab2" className="mt-4">
              <p className="text-sm text-muted-foreground">Contenu de l'onglet 2</p>
            </TabsContent>
            <TabsContent value="tab3" className="mt-4">
              <p className="text-sm text-muted-foreground">Contenu de l'onglet 3</p>
            </TabsContent>
          </Tabs>
        </Card>
      </section>

      {/* Theme Toggle Example */}
      <section className="space-y-6">
        <div>
          <h2>Dark Mode</h2>
          <p className="text-sm text-muted-foreground">Tous les composants supportent le mode sombre</p>
        </div>
        <Card className="p-6">
          <p className="text-sm mb-4">
            Utilisez le bouton <Moon className="inline" size={16} /> / <Sun className="inline" size={16} /> dans la topbar pour basculer entre les thèmes.
            Le thème est persisté dans localStorage.
          </p>
          <div className="p-4 rounded-lg bg-muted">
            <code className="text-sm">localStorage.getItem('admin_theme') // 'light' | 'dark'</code>
          </div>
        </Card>
      </section>

      {/* Dialog Demo */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exemple de Dialog</DialogTitle>
            <DialogDescription>
              Ceci est un exemple de dialog modal. Il peut contenir des formulaires, des confirmations, etc.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => setDialogOpen(false)}>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sheet Demo */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Exemple de Drawer</SheetTitle>
            <SheetDescription>
              Les drawers sont parfaits pour afficher des détails, des formulaires ou des informations complémentaires.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <p className="text-sm text-muted-foreground">
              Les drawers sont parfaits pour afficher des détails, des formulaires ou des informations complémentaires.
            </p>
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label>Exemple de champ</Label>
                <Input placeholder="Entrez une valeur..." />
              </div>
              <Button className="w-full">Action</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}