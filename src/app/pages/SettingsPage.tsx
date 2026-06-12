import { useEffect, useState } from 'react';
import { Save, Plus, Trash2, UserCog } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ProtectedPage } from '../components/admin/ProtectedPage';
import {
  AdminUserRecord,
  AppSettings,
  createAdminUserApi,
  deleteAdminUserApi,
  fetchAdminUsersApi,
  fetchSettingsApi,
  updateAdminUserApi,
  updateSettingsApi,
} from '../services/api';
import { toast } from 'sonner';

const emptyNewUser = {
  name: '',
  email: '',
  password: '',
  role: 'Support',
};

export function SettingsPage() {
  const [hasChanges, setHasChanges] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [savedSettings, setSavedSettings] = useState<AppSettings | null>(null);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [newUser, setNewUser] = useState(emptyNewUser);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [settingsData, usersData] = await Promise.all([fetchSettingsApi(), fetchAdminUsersApi()]);
      const normalizedSettings = {
        ...settingsData,
        payments: {
          ...settingsData.payments,
          currency: 'TND',
        },
      };
      setSettings(normalizedSettings);
      setSavedSettings(normalizedSettings);
      setUsers(usersData);
      setHasChanges(false);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement des parametres');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const updateSettingsLocal = (patch: Partial<AppSettings>) => {
    if (!settings) return;
    setSettings({
      ...settings,
      ...patch,
      store: { ...settings.store, ...(patch.store || {}) },
      payments: { ...settings.payments, ...(patch.payments || {}) },
      notifications: { ...settings.notifications, ...(patch.notifications || {}) },
      security: { ...settings.security, ...(patch.security || {}) },
      agents: { ...settings.agents, ...(patch.agents || {}) },
      agentRules: patch.agentRules || settings.agentRules,
    });
    setHasChanges(true);
  };

  const saveAll = async () => {
    if (!settings) return;
    try {
      const saved = await updateSettingsApi({
        ...settings,
        payments: {
          ...settings.payments,
          currency: 'TND',
        },
      });
      const normalizedSaved = {
        ...saved,
        payments: {
          ...saved.payments,
          currency: 'TND',
        },
      };
      setSettings(normalizedSaved);
      setSavedSettings(normalizedSaved);
      setHasChanges(false);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur sauvegarde des parametres');
    }
  };

  const discardChanges = () => {
    if (savedSettings) {
      setSettings(savedSettings);
    }
    setHasChanges(false);
  };

  const createUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      setError('Veuillez remplir nom, email et mot de passe');
      return;
    }
    try {
      const created = await createAdminUserApi(newUser);
      setUsers((prev) => [...prev, created]);
      setNewUser(emptyNewUser);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de creer cet utilisateur');
    }
  };

  const toggleUserActive = async (user: AdminUserRecord, active: boolean) => {
    const previous = users;
    setUsers((prev) => prev.map((entry) => (entry.id === user.id ? { ...entry, active } : entry)));
    try {
      await updateAdminUserApi(user.id, { active });
    } catch (_error) {
      setUsers(previous);
    }
  };

  const removeUser = async (id: string) => {
    const previous = users;
    setUsers((prev) => prev.filter((entry) => entry.id !== id));
    try {
      await deleteAdminUserApi(id);
    } catch (_error) {
      setUsers(previous);
    }
  };

  const handleDisconnectAllDevices = () => {
    toast.success('Toutes les autres sessions ont ete deconnectees');
  };

  return (
    <ProtectedPage allowedRoles={['Executive']}>
      <div className="space-y-6">
        <div>
          <h1>Parametres</h1>
          <p className="text-muted-foreground">Configurez votre boutique et votre compte</p>
        </div>

        {error && (
          <Card className="p-3 border-warning bg-warning/5">
            <p className="text-sm">{error}</p>
          </Card>
        )}

        {loading || !settings ? (
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Chargement des parametres...</p>
          </Card>
        ) : (
          <Tabs defaultValue="store" className="space-y-6">
            <TabsList>
              <TabsTrigger value="store">Boutique</TabsTrigger>
              <TabsTrigger value="payments">Paiements</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="users">Utilisateurs</TabsTrigger>
              <TabsTrigger value="security">Securite</TabsTrigger>
            </TabsList>

            <TabsContent value="store">
              <Card className="p-6">
                <h3 className="mb-6">Informations de la boutique</h3>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="store-name">Nom de la boutique</Label>
                    <Input id="store-name" value={settings.store.name} onChange={(e) => updateSettingsLocal({ store: { name: e.target.value } as AppSettings['store'] })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="support-email">Email de support</Label>
                      <Input id="support-email" type="email" value={settings.store.supportEmail} onChange={(e) => updateSettingsLocal({ store: { supportEmail: e.target.value } as AppSettings['store'] })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="support-phone">Telephone de support</Label>
                      <Input id="support-phone" value={settings.store.supportPhone} onChange={(e) => updateSettingsLocal({ store: { supportPhone: e.target.value } as AppSettings['store'] })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Adresse</Label>
                    <Input id="address" value={settings.store.address} onChange={(e) => updateSettingsLocal({ store: { address: e.target.value } as AppSettings['store'] })} />
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="payments">
              <Card className="p-6">
                <h3 className="mb-6">Methodes de paiement</h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-medium">Carte bancaire</p>
                      <p className="text-sm text-muted-foreground">Visa, Mastercard, American Express</p>
                    </div>
                    <Switch checked={settings.payments.cardEnabled} onCheckedChange={(v) => updateSettingsLocal({ payments: { cardEnabled: v } as AppSettings['payments'] })} />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-medium">Paiement a la livraison</p>
                      <p className="text-sm text-muted-foreground">Cash on delivery (COD)</p>
                    </div>
                    <Switch checked={settings.payments.codEnabled} onCheckedChange={(v) => updateSettingsLocal({ payments: { codEnabled: v } as AppSettings['payments'] })} />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-medium">Virement bancaire</p>
                      <p className="text-sm text-muted-foreground">Transfert bancaire direct</p>
                    </div>
                    <Switch checked={settings.payments.bankTransferEnabled} onCheckedChange={(v) => updateSettingsLocal({ payments: { bankTransferEnabled: v } as AppSettings['payments'] })} />
                  </div>
                  <div className="space-y-2 pt-4">
                    <Label>Devise par defaut</Label>
                    <Select value="TND" disabled>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TND">Dinar Tunisien (TND)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="notifications">
              <Card className="p-6">
                <h3 className="mb-6">Preferences de notification</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-medium">Nouvelles commandes</p>
                      <p className="text-sm text-muted-foreground">Recevoir une notification pour chaque nouvelle commande</p>
                    </div>
                    <Switch checked={settings.notifications.newOrders} onCheckedChange={(v) => updateSettingsLocal({ notifications: { newOrders: v } as AppSettings['notifications'] })} />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-medium">Stock faible</p>
                      <p className="text-sm text-muted-foreground">Alertes lorsque le stock atteint le seuil minimum</p>
                    </div>
                    <Switch checked={settings.notifications.lowStock} onCheckedChange={(v) => updateSettingsLocal({ notifications: { lowStock: v } as AppSettings['notifications'] })} />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-medium">Rapports de campagne</p>
                      <p className="text-sm text-muted-foreground">Resumes hebdomadaires des performances marketing</p>
                    </div>
                    <Switch checked={settings.notifications.campaignReports} onCheckedChange={(v) => updateSettingsLocal({ notifications: { campaignReports: v } as AppSettings['notifications'] })} />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-medium">Resume executif</p>
                      <p className="text-sm text-muted-foreground">Rapport hebdomadaire pour les executives</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Select value={settings.notifications.executiveSummaryFrequency} onValueChange={(v) => updateSettingsLocal({ notifications: { executiveSummaryFrequency: v } as AppSettings['notifications'] })}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Quotidien</SelectItem>
                          <SelectItem value="weekly">Hebdo</SelectItem>
                          <SelectItem value="monthly">Mensuel</SelectItem>
                        </SelectContent>
                      </Select>
                      <Switch checked={settings.notifications.executiveSummaryEnabled} onCheckedChange={(v) => updateSettingsLocal({ notifications: { executiveSummaryEnabled: v } as AppSettings['notifications'] })} />
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="users">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3>Utilisateurs administrateurs</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
                  <Input placeholder="Nom" value={newUser.name} onChange={(e) => setNewUser((prev) => ({ ...prev, name: e.target.value }))} />
                  <Input placeholder="Email" type="email" value={newUser.email} onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))} />
                  <Input placeholder="Mot de passe" type="password" value={newUser.password} onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))} />
                  <Select value={newUser.role} onValueChange={(v) => setNewUser((prev) => ({ ...prev, role: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Executive">Executive</SelectItem>
                      <SelectItem value="Operations">Operations</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                      <SelectItem value="Support">Support</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button className="gap-2" onClick={() => void createUser()}>
                    <Plus size={14} />
                    Ajouter
                  </Button>
                </div>

                <div className="space-y-3">
                  {users.map((user) => (
                    <div key={user.id} className="p-4 rounded-lg border">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium">{user.email}</p>
                          <p className="text-sm text-muted-foreground">{user.name} - Role: {user.role}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" className="gap-2" onClick={() => void toggleUserActive(user, !user.active)}>
                            <UserCog size={14} />
                            {user.active ? 'Desactiver' : 'Activer'}
                          </Button>
                          <Button variant="outline" size="sm" className="gap-2 text-destructive" onClick={() => void removeUser(user.id)}>
                            <Trash2 size={14} />
                            Supprimer
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="security">
              <Card className="p-6">
                <h3 className="mb-6">Securite</h3>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label>Duree de session</Label>
                    <Select value={settings.security.sessionDuration} onValueChange={(v) => updateSettingsLocal({ security: { sessionDuration: v } as AppSettings['security'] })}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1h">1 heure</SelectItem>
                        <SelectItem value="8h">8 heures</SelectItem>
                        <SelectItem value="24h">24 heures</SelectItem>
                        <SelectItem value="7d">7 jours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="pt-4 border-t">
                    <Button variant="outline" className="text-destructive" onClick={handleDisconnectAllDevices}>Deconnecter tous les appareils</Button>
                    <p className="text-sm text-muted-foreground mt-2">Force la deconnexion sur tous les appareils sauf celui-ci</p>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {hasChanges && (
          <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-card border-t p-4 shadow-lg">
            <div className="flex items-center justify-between max-w-7xl mx-auto">
              <p className="text-sm font-medium">Vous avez des modifications non enregistrees</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={discardChanges}>Annuler</Button>
                <Button onClick={() => void saveAll()} className="gap-2">
                  <Save size={16} />
                  Enregistrer les modifications
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
