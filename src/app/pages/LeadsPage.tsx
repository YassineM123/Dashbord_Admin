import { useEffect, useMemo, useState } from 'react';
import { Search, MapPin, UserPlus, MessageSquare, X, Phone, Mail, Building2, ExternalLink, Download, Loader2, Save } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../components/ui/sheet';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { EmptyState } from '../components/admin/EmptyState';
import { StatusBadge } from '../components/admin/StatusBadge';
import {
  LeadRecord,
  LeadStatus,
  bulkLeadActionApi,
  fetchLeadsApi,
  fetchScrapeJobApi,
  startLeadScrapeApi,
  updateLeadApi,
} from '../services/api';
import { toast } from 'sonner';

const statusConfig = {
  nouveau: { label: 'Nouveau', type: 'info' as const },
  contacte: { label: 'Contacte', type: 'warning' as const },
  converti: { label: 'Converti', type: 'success' as const },
};

const cities = ['Tunis', 'Sfax', 'Sousse', 'Bizerte', 'Nabeul', 'Gabes', 'Kairouan'];
const categories = ['Decoration', 'Mobilier', 'Construction', 'Electronique', 'Alimentaire'];

export function LeadsPage() {
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadRecord | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [statusFilters, setStatusFilters] = useState<LeadStatus[]>([]);
  const [isScrapingDialogOpen, setIsScrapingDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [notes, setNotes] = useState('');

  const [scrapeQuery, setScrapeQuery] = useState('');
  const [scrapeCategory, setScrapeCategory] = useState('all');
  const [scrapeCity, setScrapeCity] = useState('Tunis');
  const [scrapeLimit, setScrapeLimit] = useState('50');

  const loadLeads = async () => {
    setIsLoading(true);
    try {
      const status = statusFilters.length === 1 ? statusFilters[0] : '';
      const data = await fetchLeadsApi({
        search: searchQuery,
        city: cityFilter,
        status,
      });
      setLeads(data);
      setLoadError('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Erreur de chargement des leads');
      setLeads([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadLeads();
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, cityFilter, statusFilters.join('|')]);

  useEffect(() => {
    setNotes(selectedLead?.notes || '');
  }, [selectedLead]);

  const filteredLeads = useMemo(() => leads, [leads]);

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeads((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]
    );
  };

  const toggleStatusFilter = (status: LeadStatus) => {
    setStatusFilters((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const handleStartScraping = async () => {
    setIsLoading(true);
    try {
      const job = await startLeadScrapeApi({
        query: scrapeQuery,
        category: scrapeCategory,
        city: scrapeCity,
        limit: Number(scrapeLimit),
      });

      let attempts = 0;
      while (attempts < 30) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 600));
        // eslint-disable-next-line no-await-in-loop
        const status = await fetchScrapeJobApi(job.id);
        if (status.status === 'completed') {
          break;
        }
        attempts += 1;
      }

      await loadLeads();
      setIsScrapingDialogOpen(false);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Echec du scraping');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkAction = async (action: 'add_to_crm' | 'mark_contacted' | 'mark_converted') => {
    if (!selectedLeads.length) {
      return;
    }
    setIsLoading(true);
    try {
      await bulkLeadActionApi(selectedLeads, action);
      setSelectedLeads([]);
      await loadLeads();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Action groupée echouee');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedLead) {
      return;
    }
    try {
      const updated = await updateLeadApi(selectedLead.id, { notes });
      setSelectedLead(updated);
      setLeads((prev) => prev.map((lead) => (lead.id === updated.id ? updated : lead)));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Impossible d\'enregistrer les notes');
    }
  };

  const handleMarkContacted = async () => {
    if (!selectedLead) return;
    try {
      const updated = await updateLeadApi(selectedLead.id, { status: 'contacte' });
      setSelectedLead(updated);
      setLeads((prev) => prev.map((lead) => (lead.id === updated.id ? updated : lead)));
      toast.success('Lead marque comme contacte');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Impossible de mettre a jour le statut du lead');
    }
  };

  const handleAddSelectedLeadToCrm = async () => {
    if (!selectedLead) return;
    try {
      const updated = await updateLeadApi(selectedLead.id, {
        notes: `${selectedLead.notes || ''} [Ajoute au CRM]`.trim(),
      });
      setSelectedLead(updated);
      setLeads((prev) => prev.map((lead) => (lead.id === updated.id ? updated : lead)));
      toast.success('Lead ajoute au CRM');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Impossible d ajouter ce lead au CRM');
    }
  };

  const handleOpenLeadInMaps = () => {
    if (!selectedLead) {
      return;
    }
    const target = selectedLead.address || `${selectedLead.name} ${selectedLead.city}`;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1>Generation de leads</h1>
          <p className="text-muted-foreground">Scrapez et gerez vos leads depuis differentes sources</p>
        </div>
        <Button onClick={() => setIsScrapingDialogOpen(true)} className="gap-2">
          <Download size={18} />
          Lancer scraping
        </Button>
      </div>

      {loadError && (
        <Card className="p-4 border-warning bg-warning/5">
          <p className="text-sm">{loadError}</p>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Rechercher (ex: decoration Tunis)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-full lg:w-48">
              <MapPin size={16} className="mr-2" />
              <SelectValue placeholder="Ville" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les villes</SelectItem>
              {cities.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-sm text-muted-foreground hidden lg:inline">Statut:</span>
            {(['nouveau', 'contacte', 'converti'] as LeadStatus[]).map((status) => (
              <Badge
                key={status}
                variant={statusFilters.includes(status) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => toggleStatusFilter(status)}
              >
                {statusConfig[status].label}
              </Badge>
            ))}
          </div>
        </div>
      </Card>

      {selectedLeads.length > 0 && (
        <Card className="p-4 bg-primary/5 border-primary">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">
                {selectedLeads.length} lead{selectedLeads.length > 1 ? 's' : ''} selectionne{selectedLeads.length > 1 ? 's' : ''}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="default" onClick={() => void handleBulkAction('add_to_crm')}>
                  <UserPlus size={16} className="mr-2" />
                  Ajouter au CRM
                </Button>
                <Button size="sm" variant="outline" onClick={() => void handleBulkAction('mark_contacted')}>
                  <MessageSquare size={16} className="mr-2" />
                  Marquer comme contacte
                </Button>
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSelectedLeads([])}>
              <X size={16} />
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Chargement des leads...</p>
        </Card>
      ) : filteredLeads.length === 0 ? (
        <EmptyState
          icon={<Building2 size={48} />}
          title="Aucun lead trouve"
          description="Lancez un scraping pour commencer a generer des leads"
          action={(
            <Button onClick={() => setIsScrapingDialogOpen(true)}>
              Lancer scraping
            </Button>
          )}
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left p-4">
                    <Checkbox
                      checked={selectedLeads.length > 0 && selectedLeads.length === filteredLeads.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedLeads(filteredLeads.map((l) => l.id));
                        } else {
                          setSelectedLeads([]);
                        }
                      }}
                    />
                  </th>
                  <th className="text-left p-4 text-sm font-medium">Nom</th>
                  <th className="text-left p-4 text-sm font-medium">Categorie</th>
                  <th className="text-left p-4 text-sm font-medium">Telephone</th>
                  <th className="text-left p-4 text-sm font-medium">Ville</th>
                  <th className="text-left p-4 text-sm font-medium">Source</th>
                  <th className="text-left p-4 text-sm font-medium">Statut</th>
                  <th className="text-left p-4 text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="p-4">
                      <Checkbox
                        checked={selectedLeads.includes(lead.id)}
                        onCheckedChange={() => toggleLeadSelection(lead.id)}
                      />
                    </td>
                    <td className="p-4">
                      <div className="font-medium">{lead.name}</div>
                      <div className="text-sm text-muted-foreground">{lead.id}</div>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline">{lead.category}</Badge>
                    </td>
                    <td className="p-4 text-sm">{lead.phone}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin size={14} className="text-muted-foreground" />
                        {lead.city}
                      </div>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{lead.source}</td>
                    <td className="p-4">
                      <StatusBadge status={statusConfig[lead.status].label} type={statusConfig[lead.status].type} />
                    </td>
                    <td className="p-4">
                      <Button size="sm" variant="ghost" onClick={() => setSelectedLead(lead)}>
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

      <Sheet open={selectedLead !== null} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedLead && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedLead.name}</SheetTitle>
                <SheetDescription>Details du lead et actions</SheetDescription>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                <div>
                  <label className="text-sm font-medium mb-2 block">Statut</label>
                  <StatusBadge status={statusConfig[selectedLead.status].label} type={statusConfig[selectedLead.status].type} />
                </div>

                <Card className="p-4 space-y-3">
                  <h3 className="font-medium">Informations de contact</h3>
                  <div className="flex items-center gap-3 text-sm">
                    <Phone size={16} className="text-muted-foreground" />
                    <span>{selectedLead.phone}</span>
                  </div>
                  {selectedLead.email && (
                    <div className="flex items-center gap-3 text-sm">
                      <Mail size={16} className="text-muted-foreground" />
                      <span>{selectedLead.email}</span>
                    </div>
                  )}
                  {selectedLead.address && (
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin size={16} className="text-muted-foreground" />
                      <span>{selectedLead.address}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-sm">
                    <Building2 size={16} className="text-muted-foreground" />
                    <span>{selectedLead.category}</span>
                  </div>
                </Card>

                <div>
                  <label className="text-sm font-medium mb-2 block">Notes</label>
                  <Textarea
                    placeholder="Ajouter des notes sur ce lead..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Button className="w-full gap-2" onClick={() => void handleMarkContacted()}>
                    <MessageSquare size={16} />
                    Envoyer message
                  </Button>
                  <Button variant="outline" className="w-full gap-2" onClick={() => void handleAddSelectedLeadToCrm()}>
                    <UserPlus size={16} />
                    Ajouter au CRM
                  </Button>
                  <Button variant="outline" className="w-full gap-2" onClick={() => void handleSaveNotes()}>
                    <Save size={16} />
                    Enregistrer notes
                  </Button>
                  <Button variant="outline" className="w-full gap-2" onClick={handleOpenLeadInMaps}>
                    <ExternalLink size={16} />
                    Voir sur Maps
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={isScrapingDialogOpen} onOpenChange={setIsScrapingDialogOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Lancer un scraping</SheetTitle>
            <SheetDescription>Configurez les parametres de scraping pour generer des leads</SheetDescription>
          </SheetHeader>

          <div className="space-y-6 mt-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Recherche</label>
              <Input placeholder="Ex: restaurant Tunis" value={scrapeQuery} onChange={(e) => setScrapeQuery(e.target.value)} />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Categorie</label>
              <Select value={scrapeCategory} onValueChange={setScrapeCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Ville</label>
              <Select value={scrapeCity} onValueChange={setScrapeCity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Nombre de resultats</label>
              <Select value={scrapeLimit} onValueChange={setScrapeLimit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button className="w-full gap-2" onClick={() => void handleStartScraping()} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Scraping en cours...
                </>
              ) : (
                <>
                  <Download size={16} />
                  Lancer le scraping
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
