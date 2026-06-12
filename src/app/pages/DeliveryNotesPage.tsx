import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Download, FileText, Plus, Printer, Search, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  DeliveryNoteRecord,
  downloadDeliveryNotePdfApi,
  fetchDeliveryNoteByIdApi,
  fetchDeliveryNotesApi,
  generateDeliveryNoteFromOrderApi,
} from '../services/api';

const deliveryStatuses = ['Waiting', 'Assigned', 'Picked up', 'On the way', 'Delivered', 'Failed', 'Returned'];

function shortDate(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('fr-TN');
}

function statusClass(status?: string) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'delivered') return 'bg-success/10 text-success';
  if (normalized === 'failed' || normalized === 'returned') return 'bg-destructive/10 text-destructive';
  if (normalized === 'on the way' || normalized === 'picked up') return 'bg-info/10 text-info';
  return 'bg-muted text-muted-foreground';
}

function noteLines(note: DeliveryNoteRecord) {
  return note.lines?.length ? note.lines : note.lineItems || [];
}

function base64ToBlob(base64: string, contentType: string) {
  const bytes = atob(base64);
  const chunks = [];
  for (let index = 0; index < bytes.length; index += 1024) {
    const slice = bytes.slice(index, index + 1024);
    chunks.push(new Uint8Array(Array.from(slice, (char) => char.charCodeAt(0))));
  }
  return new Blob(chunks, { type: contentType });
}

function printHtml(note: DeliveryNoteRecord) {
  const rows = noteLines(note)
    .map(
      (line) => `
        <tr>
          <td>${line.name}</td>
          <td>${line.sku || '-'}</td>
          <td>${line.size || '-'}</td>
          <td>${line.color || '-'}</td>
          <td>${line.material || '-'}</td>
          <td class="right">${line.quantity}</td>
        </tr>`
    )
    .join('');

  return `<!doctype html>
  <html>
    <head>
      <title>${note.number}</title>
      <style>
        body { font-family: Arial, sans-serif; color: #111827; margin: 32px; }
        h1 { margin: 0 0 8px; font-size: 28px; }
        .muted { color: #6b7280; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 28px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 24px; }
        th, td { border-bottom: 1px solid #e5e7eb; padding: 10px; text-align: left; font-size: 13px; }
        th { color: #6b7280; }
        .right { text-align: right; }
      </style>
    </head>
    <body>
      <h1>Bon de livraison ${note.number}</h1>
      <div class="muted">Commande: ${note.orderId} | Facture: ${note.invoiceId || '-'} | Date: ${shortDate(note.createdAt)}</div>
      <div class="grid">
        <section>
          <h3>Boutique</h3>
          <strong>${note.business?.name || '-'}</strong><br />
          ${note.business?.email || ''}<br />
          ${note.business?.phone || ''}<br />
          ${note.business?.address || ''}
        </section>
        <section>
          <h3>Client</h3>
          <strong>${note.customer?.name || note.customerName || '-'}</strong><br />
          ${note.customer?.phone || ''}<br />
          ${note.customer?.address || ''} ${note.customer?.city || ''}
        </section>
      </div>
      <section>
        <h3>Livraison</h3>
        Societe: ${note.delivery?.company || '-'}<br />
        Chauffeur: ${note.delivery?.driverName || '-'}<br />
        Tracking: ${note.delivery?.trackingNumber || '-'}<br />
        Statut: ${note.delivery?.status || note.deliveryStatus || note.status || '-'}
      </section>
      <table>
        <thead><tr><th>Produit</th><th>SKU</th><th>Taille</th><th>Couleur</th><th>Matiere</th><th class="right">Quantite</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
  </html>`;
}

export function DeliveryNotesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [notes, setNotes] = useState<DeliveryNoteRecord[]>([]);
  const [selectedNote, setSelectedNote] = useState<DeliveryNoteRecord | null>(null);
  const [filters, setFilters] = useState({ status: 'all', dateFrom: '', dateTo: '', customer: '' });
  const [orderId, setOrderId] = useState('#10245');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const stats = useMemo(
    () => ({
      total: notes.length,
      delivered: notes.filter((note) => (note.deliveryStatus || note.status) === 'Delivered').length,
      pending: notes.filter((note) => !['Delivered', 'Failed', 'Returned'].includes(note.deliveryStatus || note.status)).length,
    }),
    [notes]
  );

  const load = async () => {
    setLoading(true);
    try {
      const rows = await fetchDeliveryNotesApi(filters);
      setNotes(rows);
      const requestedId = searchParams.get('note');
      setSelectedNote((prev) => {
        if (requestedId) return rows.find((note) => note.id === requestedId) || rows[0] || null;
        if (prev) return rows.find((note) => note.id === prev.id) || rows[0] || null;
        return rows[0] || null;
      });
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur bons de livraison');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const applyFilters = async () => {
    await load();
  };

  const generate = async () => {
    if (!orderId.trim()) {
      toast.error('Commande obligatoire');
      return;
    }
    setSaving(true);
    try {
      const note = await generateDeliveryNoteFromOrderApi(orderId);
      toast.success(`Bon ${note.number} genere`);
      setSelectedNote(note);
      setSearchParams({ note: note.id });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation bon de livraison echouee');
    } finally {
      setSaving(false);
    }
  };

  const openNote = async (note: DeliveryNoteRecord) => {
    setSelectedNote(note);
    setSearchParams({ note: note.id });
    try {
      setSelectedNote(await fetchDeliveryNoteByIdApi(note.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lecture bon de livraison echouee');
    }
  };

  const downloadPdf = async (note: DeliveryNoteRecord) => {
    try {
      const file = await downloadDeliveryNotePdfApi(note.id);
      const blob = base64ToBlob(file.base64, file.contentType);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Telechargement PDF echoue');
    }
  };

  const printNote = (note: DeliveryNoteRecord) => {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      toast.error('Autorisez les popups pour imprimer');
      return;
    }
    win.document.write(printHtml(note));
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1>Bons de livraison</h1>
          <p className="text-muted-foreground">Generation depuis commandes, suivi livraison, impression et PDF</p>
        </div>
        {selectedNote && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="gap-2" onClick={() => printNote(selectedNote)}>
              <Printer size={16} />
              Imprimer
            </Button>
            <Button className="gap-2" onClick={() => void downloadPdf(selectedNote)}>
              <Download size={16} />
              PDF
            </Button>
          </div>
        )}
      </div>

      {error && <Card className="border-destructive bg-destructive/5 p-4 text-sm text-destructive">{error}</Card>}

      <div className="grid gap-4 md:grid-cols-3">
        {[
          ['Bons', stats.total],
          ['Livres', stats.delivered],
          ['En cours', stats.pending],
        ].map(([label, value]) => (
          <Card key={String(label)} className="p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{loading ? '-' : value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <Label htmlFor="orderId">Generer depuis commande</Label>
            <Input id="orderId" value={orderId} onChange={(event) => setOrderId(event.target.value)} placeholder="#10245" />
          </div>
          <Button className="gap-2" onClick={() => void generate()} disabled={saving}>
            <Plus size={16} />
            Generer
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_1.4fr_auto] md:items-end">
          <div>
            <Label>Statut</Label>
            <Select value={filters.status} onValueChange={(status) => setFilters((prev) => ({ ...prev, status }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {deliveryStatuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="dateFrom">Date debut</Label>
            <Input id="dateFrom" type="date" value={filters.dateFrom} onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))} />
          </div>
          <div>
            <Label htmlFor="dateTo">Date fin</Label>
            <Input id="dateTo" type="date" value={filters.dateTo} onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value }))} />
          </div>
          <div>
            <Label htmlFor="customer">Client</Label>
            <Input id="customer" value={filters.customer} onChange={(event) => setFilters((prev) => ({ ...prev, customer: event.target.value }))} placeholder="Nom, telephone ou ville" />
          </div>
          <Button variant="outline" className="gap-2" onClick={() => void applyFilters()}>
            <Search size={16} />
            Filtrer
          </Button>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Bon</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Client</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Livraison</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Statut</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">Chargement...</td></tr>
                )}
                {!loading && notes.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">Aucun bon de livraison trouve.</td></tr>
                )}
                {!loading && notes.map((note) => (
                  <tr key={note.id} className="border-b hover:bg-accent/50">
                    <td className="px-4 py-3 text-sm">
                      <button type="button" className="flex items-center gap-2 font-medium" onClick={() => void openNote(note)}>
                        <FileText size={14} />
                        {note.number}
                      </button>
                      <p className="mt-1 text-xs text-muted-foreground">{note.orderId} - {shortDate(note.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <p className="font-medium">{note.customer?.name || note.customerName || '-'}</p>
                      <p className="text-xs text-muted-foreground">{note.customer?.phone || '-'}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <p>{note.delivery?.company || note.deliveryCompany || '-'}</p>
                      <p className="text-xs text-muted-foreground">{note.delivery?.trackingNumber || note.trackingNumber || '-'}</p>
                    </td>
                    <td className="px-4 py-3 text-sm"><Badge className={statusClass(note.deliveryStatus || note.status)}>{note.deliveryStatus || note.status}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => void openNote(note)}>Voir</Button>
                        <Button size="icon" variant="ghost" title="PDF" onClick={() => void downloadPdf(note)}>
                          <Download size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5">
          {!selectedNote ? (
            <div className="flex min-h-80 items-center justify-center text-center text-sm text-muted-foreground">
              Selectionnez un bon de livraison.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Truck size={18} />
                    <h2 className="text-xl font-semibold">{selectedNote.number}</h2>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">Commande {selectedNote.orderId} - Facture {selectedNote.invoiceId || '-'}</p>
                </div>
                <Badge className={statusClass(selectedNote.deliveryStatus || selectedNote.status)}>{selectedNote.deliveryStatus || selectedNote.status}</Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Client</p>
                  <p className="mt-2 font-medium">{selectedNote.customer?.name || selectedNote.customerName || '-'}</p>
                  <p className="text-sm text-muted-foreground">{selectedNote.customer?.phone || '-'}</p>
                  <p className="text-sm text-muted-foreground">{selectedNote.customer?.address || '-'} {selectedNote.customer?.city || ''}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Livraison</p>
                  <p className="mt-2 font-medium">{selectedNote.delivery?.company || '-'}</p>
                  <p className="text-sm text-muted-foreground">Chauffeur: {selectedNote.delivery?.driverName || '-'}</p>
                  <p className="text-sm text-muted-foreground">Tracking: {selectedNote.delivery?.trackingNumber || '-'}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Produit</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">SKU</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Variante</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Qt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {noteLines(selectedNote).map((line) => (
                      <tr key={line.id} className="border-t">
                        <td className="px-3 py-2 text-sm font-medium">{line.name}</td>
                        <td className="px-3 py-2 text-sm">{line.sku || '-'}</td>
                        <td className="px-3 py-2 text-sm text-muted-foreground">{line.size || '-'} / {line.color || '-'} / {line.material || '-'}</td>
                        <td className="px-3 py-2 text-right text-sm font-medium">{line.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="outline" className="gap-2" onClick={() => printNote(selectedNote)}>
                  <Printer size={16} />
                  Imprimer
                </Button>
                <Button className="gap-2" onClick={() => void downloadPdf(selectedNote)}>
                  <Download size={16} />
                  PDF
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
