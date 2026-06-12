import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, Plus, Receipt, TrendingUp, WalletCards } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { AccountingDashboard, ExpenseRecord, createExpenseApi, exportAccountingCsvApi, fetchAccountingDashboardApi } from '../services/api';

const expenseCategories = ['Delivery', 'Marketing', 'Ads', 'Packaging', 'Product samples', 'Software', 'Other'];
const paymentMethods = ['Cash', 'Card', 'Bank transfer', 'Online payment', 'Other'];

function money(value?: number, currency = 'TND') {
  return `${Number(value || 0).toFixed(2)} ${currency}`;
}

function shortDate(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('fr-TN');
}

export function AccountingPage() {
  const [dashboard, setDashboard] = useState<AccountingDashboard | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    category: 'Delivery',
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    paymentMethod: 'Cash',
    note: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const currency = dashboard?.currency || 'TND';
  const latestExpenses = useMemo(() => dashboard?.expensesList.slice(0, 8) || [], [dashboard]);

  const load = async () => {
    setLoading(true);
    try {
      setDashboard(await fetchAccountingDashboardApi());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur comptabilite');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createExpense = async () => {
    if (!expenseForm.title.trim()) {
      toast.error('Titre obligatoire');
      return;
    }
    if (Number(expenseForm.amount) <= 0) {
      toast.error('Montant invalide');
      return;
    }
    setSaving(true);
    try {
      await createExpenseApi({
        ...expenseForm,
        amount: Number(expenseForm.amount),
        date: new Date(expenseForm.date).toISOString(),
      });
      toast.success('Depense ajoutee');
      setExpenseForm((prev) => ({ ...prev, title: '', amount: 0, note: '' }));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Creation depense echouee');
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = async () => {
    try {
      const file = await exportAccountingCsvApi();
      const blob = new Blob([file.content], { type: file.contentType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export CSV echoue');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1>Comptabilite simple</h1>
          <p className="text-muted-foreground">Suivi revenu, depenses, marge et profit pour petits vendeurs e-commerce</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => void exportCsv()}>
          <Download size={16} />
          Export CSV
        </Button>
      </div>

      {error && <Card className="border-destructive bg-destructive/5 p-4 text-sm text-destructive">{error}</Card>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['Total revenue', dashboard?.totalRevenue, TrendingUp],
          ['Total expenses', dashboard?.totalExpenses, Receipt],
          ['Estimated profit', dashboard?.estimatedProfit, WalletCards],
          ['Gross profit', dashboard?.grossProfit, BarChart3],
        ].map(([label, value, Icon]) => (
          <Card key={String(label)} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{String(label)}</p>
              <Icon className="text-muted-foreground" size={18} />
            </div>
            <p className="mt-3 text-2xl font-semibold">{loading ? '-' : money(Number(value || 0), currency)}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ['Gross margin', `${dashboard?.grossMargin ?? 0}%`],
          ['Product cost', money(dashboard?.productCost, currency)],
          ['Delivery fees', money(dashboard?.deliveryFees, currency)],
          ['Ad spend', money(dashboard?.adSpend, currency)],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-xl font-semibold">{loading ? '-' : value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Monthly profit</h2>
              <p className="text-sm text-muted-foreground">Revenue - product costs - expenses</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboard?.monthlyProfit || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => money(Number(value), currency)} />
                <Bar dataKey="revenue" fill="#2563eb" name="Revenue" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#f59e0b" name="Expenses" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" fill="#16a34a" name="Profit" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-lg font-semibold">Add expense</h2>
          <div className="mt-4 grid gap-3">
            <div>
              <Label htmlFor="expenseTitle">Title</Label>
              <Input id="expenseTitle" value={expenseForm.title} onChange={(event) => setExpenseForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Courier payout, Meta ads..." />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Category</Label>
                <Select value={expenseForm.category} onValueChange={(category) => setExpenseForm((prev) => ({ ...prev, category }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" type="number" min="0" value={expenseForm.amount} onChange={(event) => setExpenseForm((prev) => ({ ...prev, amount: Number(event.target.value) }))} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="expenseDate">Date</Label>
                <Input id="expenseDate" type="date" value={expenseForm.date} onChange={(event) => setExpenseForm((prev) => ({ ...prev, date: event.target.value }))} />
              </div>
              <div>
                <Label>Payment method</Label>
                <Select value={expenseForm.paymentMethod} onValueChange={(paymentMethod) => setExpenseForm((prev) => ({ ...prev, paymentMethod }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((method) => <SelectItem key={method} value={method}>{method}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="note">Note</Label>
              <Input id="note" value={expenseForm.note} onChange={(event) => setExpenseForm((prev) => ({ ...prev, note: event.target.value }))} placeholder="Optional" />
            </div>
            <Button className="gap-2" onClick={() => void createExpense()} disabled={saving}>
              <Plus size={16} />
              Add expense
            </Button>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-lg font-semibold">Daily revenue</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dashboard?.dailyRevenue || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => money(Number(value), currency)} />
                <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <div className="border-b p-5">
            <h2 className="text-lg font-semibold">Best profit products</h2>
            <p className="text-sm text-muted-foreground">Top products by gross profit</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Product</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Revenue</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Profit</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Margin</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard?.bestProfitProducts || []).map((product) => (
                  <tr key={`${product.productId}-${product.sku}`} className="border-b">
                    <td className="px-4 py-3 text-sm">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">SKU {product.sku || '-'} - Qty {product.quantity}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-sm">{money(product.revenue, currency)}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium">{money(product.profit, currency)}</td>
                    <td className="px-4 py-3 text-right text-sm"><Badge variant="outline">{product.margin}%</Badge></td>
                  </tr>
                ))}
                {!loading && !dashboard?.bestProfitProducts.length && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">No product profit data yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card>
        <div className="border-b p-5">
          <h2 className="text-lg font-semibold">Expenses tracking</h2>
          <p className="text-sm text-muted-foreground">Simple expense list for seller decisions</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Title</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Payment</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">Loading accounting...</td></tr>}
              {!loading && latestExpenses.map((expense: ExpenseRecord) => (
                <tr key={expense.id} className="border-b">
                  <td className="px-4 py-3 text-sm">
                    <p className="font-medium">{expense.title}</p>
                    <p className="text-xs text-muted-foreground">{expense.note || '-'}</p>
                  </td>
                  <td className="px-4 py-3 text-sm">{expense.category}</td>
                  <td className="px-4 py-3 text-sm">{shortDate(expense.date)}</td>
                  <td className="px-4 py-3 text-sm">{expense.paymentMethod}</td>
                  <td className="px-4 py-3 text-right text-sm font-medium">{money(expense.amount, currency)}</td>
                </tr>
              ))}
              {!loading && latestExpenses.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">No expenses yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
