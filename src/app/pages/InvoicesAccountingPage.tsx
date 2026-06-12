import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Download, FileText, Plus, Printer, Search, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  AccountingSummary,
  InvoiceCreatePayload,
  InvoiceRecord,
  createInvoiceFromOrderApi,
  downloadInvoicePdfApi,
  exportAccountingCsvApi,
  fetchAccountingSummaryApi,
  fetchInvoiceByIdApi,
  fetchInvoicesApi,
  sendInvoicePlaceholderApi,
  updateInvoiceApi,
} from '../services/api';

const invoiceStatuses = ['Draft', 'Sent', 'Paid', 'Cancelled'];
const paymentStatuses = ['Unpaid', 'Paid', 'Cash on Delivery', 'Refunded'];

function money(value: number | undefined, currency = 'TND') {
  return `${Number(value || 0).toFixed(2)} ${currency}`;
}

function shortDate(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('fr-TN');
}

function statusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === 'paid') return 'bg-success/10 text-success';
  if (normalized === 'sent') return 'bg-info/10 text-info';
  if (normalized === 'cancelled') return 'bg-destructive/10 text-destructive';
  return 'bg-muted text-muted-foreground';
}

function base64ToBlob(base64: string, contentType: string) {
  const bytes = atob(base64);
  const chunks = [];
  for (let index = 0; index < bytes.length; index += 1024) {
    const slice = bytes.slice(index, index + 1024);
    const numbers = Array.from(slice, (char) => char.charCodeAt(0));
    chunks.push(new Uint8Array(numbers));
  }
  return new Blob(chunks, { type: contentType });
}

function invoicePrintHtml(invoice: InvoiceRecord) {
  const rows = invoice.lines
    .map(
      (line) => `
        <tr>
          <td>${line.name}</td>
          <td>${line.sku || '-'}</td>
          <td class="right">${line.quantity}</td>
          <td class="right">${money(line.unitPrice, invoice.currency)}</td>
          <td class="right">${money(line.taxAmount, invoice.currency)}</td>
          <td class="right">${money(line.discountAmount, invoice.currency)}</td>
          <td class="right">${money(line.total, invoice.currency)}</td>
        </tr>`
    )
    .join('');

  return `<!doctype html>
  <html>
    <head>
      <title>${invoice.number}</title>
      <style>
        body { font-family: Arial, sans-serif; color: #111827; margin: 32px; }
        h1 { margin: 0 0 8px; font-size: 28px; }
        .muted { color: #6b7280; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 28px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 24px; }
        th, td { border-bottom: 1px solid #e5e7eb; padding: 10px; text-align: left; font-size: 13px; }
        th { color: #6b7280; }
        .right { text-align: right; }
        .totals { margin-left: auto; width: 320px; margin-top: 24px; }
        .totals div { display: flex; justify-content: space-between; padding: 6px 0; }
        .total { font-size: 18px; font-weight: 700; border-top: 1px solid #111827; margin-top: 8px; padding-top: 10px; }
      </style>
    </head>
    <body>
      <h1>${invoice.number}</h1>
      <div class="muted">Status: ${invoice.status} | Payment: ${invoice.paymentStatus} | Date: ${shortDate(invoice.issueDate)}</div>
      <div class="grid">
        <section>
          <h3>Store</h3>
          <strong>${invoice.business?.name || '-'}</strong><br />
          ${invoice.business?.email || ''}<br />
          ${invoice.business?.phone || ''}<br />
          ${invoice.business?.address || ''}
        </section>
        <section>
          <h3>Customer</h3>
          <strong>${invoice.customer?.name || invoice.customerName || '-'}</strong><br />
          ${invoice.customer?.email || ''}<br />
          ${invoice.customer?.phone || ''}<br />
          ${invoice.customer?.address || ''} ${invoice.customer?.city || ''}
        </section>
      </div>
      <table>
        <thead>
          <tr>
            <th>Product</th><th>SKU</th><th class="right">Qty</th><th class="right">Unit</th>
            <th class="right">Tax</th><th class="right">Discount</th><th class="right">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals">
        <div><span>Subtotal</span><span>${money(invoice.subtotal, invoice.currency)}</span></div>
        <div><span>Tax</span><span>${money(invoice.taxTotal, invoice.currency)}</span></div>
        <div><span>Discount</span><span>${money(invoice.discountTotal, invoice.currency)}</span></div>
        <div><span>Delivery</span><span>${money(invoice.deliveryFee, invoice.currency)}</span></div>
        <div class="total"><span>Total</span><span>${money(invoice.total, invoice.currency)}</span></div>
      </div>
    </body>
  </html>`;
}

export function InvoicesAccountingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [summary, setSummary] = useState<AccountingSummary | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [filters, setFilters] = useState({ status: 'all', dateFrom: '', dateTo: '', customer: '' });
  const [createForm, setCreateForm] = useState<InvoiceCreatePayload>({
    orderId: '#10245',
    taxRate: 0,
    discountRate: 0,
    deliveryFee: 0,
    status: 'Draft',
    paymentStatus: 'Unpaid',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const totals = useMemo(
    () => ({
      invoices: invoices.length,
      paid: invoices.filter((invoice) => invoice.status === 'Paid').length,
      unpaid: invoices.filter((invoice) => invoice.paymentStatus !== 'Paid').length,
      value: invoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0),
    }),
    [invoices]
  );

  const load = async () => {
    setLoading(true);
    try {
      const [summaryData, invoiceRows] = await Promise.all([fetchAccountingSummaryApi(), fetchInvoicesApi(filters)]);
      setSummary(summaryData);
      setInvoices(invoiceRows);
      const requestedId = searchParams.get('invoice');
      setSelectedInvoice((prev) => {
        if (requestedId) return invoiceRows.find((invoice) => invoice.id === requestedId) || invoiceRows[0] || null;
        if (prev) return invoiceRows.find((invoice) => invoice.id === prev.id) || invoiceRows[0] || null;
        return invoiceRows[0] || null;
      });
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur factures');
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

  const createInvoice = async () => {
    if (!createForm.orderId.trim()) {
      toast.error('Commande obligatoire');
      return;
    }
    setSaving(true);
    try {
      const invoice = await createInvoiceFromOrderApi({
        ...createForm,
        taxRate: Number(createForm.taxRate || 0),
        discountRate: Number(createForm.discountRate || 0),
        deliveryFee: Number(createForm.deliveryFee || 0),
      });
      toast.success(`Facture ${invoice.number} creee`);
      setSelectedInvoice(invoice);
      setSearchParams({ invoice: invoice.id });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Creation facture echouee');
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = async () => {
    const file = await exportAccountingCsvApi();
    const blob = new Blob([file.content], { type: file.contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = async (invoice: InvoiceRecord) => {
    try {
      const file = await downloadInvoicePdfApi(invoice.id);
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

  const printInvoice = (invoice: InvoiceRecord) => {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      toast.error('Autorisez les popups pour imprimer');
      return;
    }
    win.document.write(invoicePrintHtml(invoice));
    win.document.close();
    win.focus();
    win.print();
  };

  const sendInvoice = async (invoice: InvoiceRecord) => {
    try {
      const updated = await sendInvoicePlaceholderApi(invoice.id);
      setSelectedInvoice(updated);
      setInvoices((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      toast.success('Envoi placeholder enregistre');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Envoi placeholder echoue');
    }
  };

  const updateStatus = async (status: string) => {
    if (!selectedInvoice) return;
    try {
      const updated = await updateInvoiceApi(selectedInvoice.id, { status });
      setSelectedInvoice(updated);
      setInvoices((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      toast.success('Statut facture mis a jour');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Mise a jour echouee');
    }
  };

  const openInvoice = async (invoice: InvoiceRecord) => {
    setSelectedInvoice(invoice);
    setSearchParams({ invoice: invoice.id });
    try {
      setSelectedInvoice(await fetchInvoiceByIdApi(invoice.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lecture facture echouee');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1>Factures & comptabilite</h1>
          <p className="text-muted-foreground">Creation depuis commande, preview, PDF, impression et suivi paiement</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="gap-2" onClick={() => void exportCsv()}>
            <Download size={16} />
            Export CSV
          </Button>
          {selectedInvoice && (
            <Button className="gap-2" onClick={() => void downloadPdf(selectedInvoice)}>
              <Download size={16} />
              PDF
            </Button>
          )}
        </div>
      </div>

      {error && <Card className="border-destructive bg-destructive/5 p-4 text-sm text-destructive">{error}</Card>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 xl:grid-cols-6">
        {[
          ['Revenu', summary?.revenue],
          ['Profit', summary?.profit],
          ['Factures', totals.invoices],
          ['Payees', totals.paid],
          ['Non payees', totals.unpaid],
          ['Valeur filtres', totals.value],
        ].map(([label, value]) => (
          <Card key={String(label)} className="p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{loading ? '-' : typeof value === 'number' && label !== 'Factures' && label !== 'Payees' && label !== 'Non payees' ? money(value) : value ?? 0}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_0.95fr_1.1fr_auto] lg:items-end">
          <div>
            <Label htmlFor="orderId">Creer depuis commande</Label>
            <Input
              id="orderId"
              value={createForm.orderId}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, orderId: event.target.value }))}
              placeholder="#10245"
            />
          </div>
          <div>
            <Label htmlFor="taxRate">Taxe %</Label>
            <Input
              id="taxRate"
              type="number"
              min="0"
              value={createForm.taxRate}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, taxRate: Number(event.target.value) }))}
            />
          </div>
          <div>
            <Label htmlFor="discountRate">Remise %</Label>
            <Input
              id="discountRate"
              type="number"
              min="0"
              value={createForm.discountRate}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, discountRate: Number(event.target.value) }))}
            />
          </div>
          <div>
            <Label htmlFor="deliveryFee">Livraison</Label>
            <Input
              id="deliveryFee"
              type="number"
              min="0"
              value={createForm.deliveryFee}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, deliveryFee: Number(event.target.value) }))}
            />
          </div>
          <div>
            <Label>Statut</Label>
            <Select value={createForm.status} onValueChange={(status) => setCreateForm((prev) => ({ ...prev, status }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {invoiceStatuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Paiement</Label>
            <Select value={createForm.paymentStatus} onValueChange={(paymentStatus) => setCreateForm((prev) => ({ ...prev, paymentStatus }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {paymentStatuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button className="gap-2" onClick={() => void createInvoice()} disabled={saving}>
            <Plus size={16} />
            Creer
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
                {invoiceStatuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
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
            <Label htmlFor="customerFilter">Client</Label>
            <Input
              id="customerFilter"
              value={filters.customer}
              onChange={(event) => setFilters((prev) => ({ ...prev, customer: event.target.value }))}
              placeholder="Nom, email ou ID client"
            />
          </div>
          <Button variant="outline" className="gap-2" onClick={() => void applyFilters()}>
            <Search size={16} />
            Filtrer
          </Button>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Facture</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Client</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Statut</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Paiement</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Total</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">Chargement des factures...</td>
                  </tr>
                )}
                {!loading && invoices.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">Aucune facture trouvee.</td>
                  </tr>
                )}
                {!loading && invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b hover:bg-accent/50">
                    <td className="px-4 py-3 text-sm">
                      <button type="button" className="flex items-center gap-2 font-medium" onClick={() => void openInvoice(invoice)}>
                        <FileText size={14} />
                        <span>{invoice.number}</span>
                      </button>
                      <p className="mt-1 text-xs text-muted-foreground">{invoice.orderId} - {shortDate(invoice.issueDate)}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">{invoice.customer?.name || invoice.customerName || invoice.customerId || '-'}</td>
                    <td className="px-4 py-3 text-sm"><Badge className={statusClass(invoice.status)}>{invoice.status}</Badge></td>
                    <td className="px-4 py-3 text-sm">{invoice.paymentStatus}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium">{money(invoice.total, invoice.currency)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => void openInvoice(invoice)}>Voir</Button>
                        <Button size="icon" variant="ghost" onClick={() => void downloadPdf(invoice)} title="Download PDF">
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
          {!selectedInvoice ? (
            <div className="flex min-h-80 items-center justify-center text-center text-sm text-muted-foreground">
              Selectionnez une facture pour voir le detail.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <FileText size={18} />
                    <h2 className="text-xl font-semibold">{selectedInvoice.number}</h2>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">Commande {selectedInvoice.orderId} - {shortDate(selectedInvoice.issueDate)}</p>
                </div>
                <Badge className={statusClass(selectedInvoice.status)}>{selectedInvoice.status}</Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Store</p>
                  <p className="mt-2 font-medium">{selectedInvoice.business?.name || '-'}</p>
                  <p className="text-sm text-muted-foreground">{selectedInvoice.business?.email || '-'}</p>
                  <p className="text-sm text-muted-foreground">{selectedInvoice.business?.phone || '-'}</p>
                  <p className="text-sm text-muted-foreground">{selectedInvoice.business?.address || '-'}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Client</p>
                  <p className="mt-2 font-medium">{selectedInvoice.customer?.name || selectedInvoice.customerName || '-'}</p>
                  <p className="text-sm text-muted-foreground">{selectedInvoice.customer?.email || '-'}</p>
                  <p className="text-sm text-muted-foreground">{selectedInvoice.customer?.phone || '-'}</p>
                  <p className="text-sm text-muted-foreground">{selectedInvoice.customer?.address || '-'} {selectedInvoice.customer?.city || ''}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Statut facture</Label>
                  <Select value={selectedInvoice.status} onValueChange={(status) => void updateStatus(status)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {invoiceStatuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Paiement</Label>
                  <Select
                    value={selectedInvoice.paymentStatus}
                    onValueChange={(paymentStatus) => {
                      if (!selectedInvoice) return;
                      void updateInvoiceApi(selectedInvoice.id, { paymentStatus }).then((updated) => {
                        setSelectedInvoice(updated);
                        setInvoices((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
                        toast.success('Paiement mis a jour');
                      }).catch((err) => toast.error(err instanceof Error ? err.message : 'Mise a jour paiement echouee'));
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {paymentStatuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Produit</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Qt</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">PU</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.lines.map((line) => (
                      <tr key={line.id} className="border-t">
                        <td className="px-3 py-2 text-sm">
                          <p className="font-medium">{line.name}</p>
                          <p className="text-xs text-muted-foreground">SKU {line.sku || '-'} - Taxe {line.taxRate}% - Remise {line.discountRate}%</p>
                        </td>
                        <td className="px-3 py-2 text-right text-sm">{line.quantity}</td>
                        <td className="px-3 py-2 text-right text-sm">{money(line.unitPrice, selectedInvoice.currency)}</td>
                        <td className="px-3 py-2 text-right text-sm font-medium">{money(line.total, selectedInvoice.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2 rounded-md bg-muted/30 p-4 text-sm">
                <div className="flex justify-between"><span>Sous-total</span><span>{money(selectedInvoice.subtotal, selectedInvoice.currency)}</span></div>
                <div className="flex justify-between"><span>Taxe</span><span>{money(selectedInvoice.taxTotal, selectedInvoice.currency)}</span></div>
                <div className="flex justify-between"><span>Remise</span><span>-{money(selectedInvoice.discountTotal, selectedInvoice.currency)}</span></div>
                <div className="flex justify-between"><span>Livraison</span><span>{money(selectedInvoice.deliveryFee, selectedInvoice.currency)}</span></div>
                <div className="flex justify-between border-t pt-2 text-base font-semibold"><span>Total</span><span>{money(selectedInvoice.total, selectedInvoice.currency)}</span></div>
              </div>

              {selectedInvoice.sendPlaceholder && (
                <div className="rounded-md border border-info/30 bg-info/5 p-3 text-sm">
                  Dernier envoi placeholder: {selectedInvoice.sendPlaceholder.to || 'sans email'} le {shortDate(selectedInvoice.sendPlaceholder.sentAt)}
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-3">
                <Button variant="outline" className="gap-2" onClick={() => printInvoice(selectedInvoice)}>
                  <Printer size={16} />
                  Imprimer
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => void sendInvoice(selectedInvoice)}>
                  <Send size={16} />
                  Envoyer
                </Button>
                <Button className="gap-2" onClick={() => void downloadPdf(selectedInvoice)}>
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
