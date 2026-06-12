import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, History, PackagePlus, Search } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { EmptyState } from '../components/admin/EmptyState';
import {
  ProductRecord,
  ProductVariantRecord,
  StockAlertRecord,
  StockMovementRecord,
  adjustProductStockApi,
  fetchProductsApi,
  fetchStockAlertsApi,
  fetchStockMovementsApi,
} from '../services/api';
import { toast } from 'sonner';

const MOVEMENT_TYPES = [
  'stock_added',
  'stock_removed',
  'order_reserved',
  'order_confirmed',
  'order_cancelled',
  'return_received',
  'manual_adjustment',
];

const adjustmentTypes = ['stock_added', 'stock_removed', 'manual_adjustment', 'return_received'];

type AdjustmentForm = {
  productId: string;
  variantId: string;
  type: string;
  quantity: string;
  reason: string;
};

const defaultAdjustment: AdjustmentForm = {
  productId: '',
  variantId: '',
  type: 'stock_added',
  quantity: '1',
  reason: 'Manual stock update',
};

function variantStatus(variant: ProductVariantRecord) {
  if (variant.stock <= 0) return 'out_of_stock';
  if (variant.stock <= variant.lowStockThreshold) return 'low_stock';
  return 'available';
}

function movementLabel(type: string) {
  return type.replace(/_/g, ' ');
}

export function StockPage() {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [alerts, setAlerts] = useState<StockAlertRecord[]>([]);
  const [movements, setMovements] = useState<StockMovementRecord[]>([]);
  const [search, setSearch] = useState('');
  const [movementProductFilter, setMovementProductFilter] = useState('all');
  const [movementTypeFilter, setMovementTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [adjustment, setAdjustment] = useState<AdjustmentForm>(defaultAdjustment);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === adjustment.productId) || null,
    [adjustment.productId, products]
  );

  const variantRows = useMemo(
    () =>
      products.flatMap((product) =>
        (product.variants || []).map((variant) => ({
          product,
          variant,
          status: variantStatus(variant),
        }))
      ),
    [products]
  );

  const load = async () => {
    setLoading(true);
    try {
      const [productRows, alertRows, movementRows] = await Promise.all([
        fetchProductsApi(),
        fetchStockAlertsApi(),
        fetchStockMovementsApi({
          productId: movementProductFilter === 'all' ? undefined : movementProductFilter,
          type: movementTypeFilter === 'all' ? undefined : movementTypeFilter,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        }),
      ]);
      setProducts(productRows);
      setAlerts(alertRows);
      setMovements(movementRows);
      setError('');
      setAdjustment((prev) => {
        if (prev.productId) return prev;
        const firstProduct = productRows[0];
        return {
          ...prev,
          productId: firstProduct?.id || '',
          variantId: firstProduct?.variants?.[0]?.id || '',
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement du stock');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movementProductFilter, movementTypeFilter, dateFrom, dateTo]);

  const filteredVariants = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return variantRows;
    return variantRows.filter(({ product, variant }) =>
      [product.name, product.sku, product.category, variant.sku, variant.size, variant.color, variant.material].some((value) =>
        String(value || '').toLowerCase().includes(q)
      )
    );
  }, [search, variantRows]);

  const totalStock = products.reduce((sum, product) => sum + Number(product.stock || 0), 0);
  const lowStock = alerts.filter((alert) => alert.type === 'low_stock').length;
  const outOfStock = alerts.filter((alert) => alert.type === 'out_of_stock').length;

  const updateAdjustmentProduct = (productId: string) => {
    const product = products.find((entry) => entry.id === productId);
    setAdjustment((prev) => ({
      ...prev,
      productId,
      variantId: product?.variants?.[0]?.id || '',
    }));
  };

  const submitAdjustment = async () => {
    if (!adjustment.productId || !adjustment.variantId) {
      toast.error('Selectionnez un produit et une variante');
      return;
    }
    const quantity = Number(adjustment.quantity);
    if (!Number.isFinite(quantity) || quantity === 0) {
      toast.error('Quantite invalide');
      return;
    }

    setSaving(true);
    try {
      await adjustProductStockApi(adjustment.productId, {
        variantId: adjustment.variantId,
        quantity,
        type: adjustment.type,
        reason: adjustment.reason,
      });
      toast.success('Mouvement de stock enregistre');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Mise a jour stock echouee');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1>Stock</h1>
        <p className="text-muted-foreground">Stock par produit, variante, seuils et mouvements</p>
      </div>

      {error && <Card className="border-warning bg-warning/5 p-4 text-sm">{error}</Card>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Stock total</p>
          <p className="text-3xl font-semibold">{totalStock}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Variantes</p>
          <p className="text-3xl font-semibold">{variantRows.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Stock faible</p>
          <p className="text-3xl font-semibold text-warning">{lowStock}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Ruptures</p>
          <p className="text-3xl font-semibold text-destructive">{outOfStock}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3>Stock par variante</h3>
              <p className="text-sm text-muted-foreground">Taille, couleur, matiere, SKU, seuil et statut</p>
            </div>
            <div className="relative md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher..." className="pl-10" />
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement du stock...</p>
          ) : filteredVariants.length === 0 ? (
            <EmptyState icon={<AlertTriangle size={40} />} title="Aucune variante" description="Aucune variante ne correspond aux filtres." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr>
                    <th className="px-3 py-3 text-left text-sm font-medium text-muted-foreground">Produit</th>
                    <th className="px-3 py-3 text-left text-sm font-medium text-muted-foreground">Variante</th>
                    <th className="px-3 py-3 text-left text-sm font-medium text-muted-foreground">SKU</th>
                    <th className="px-3 py-3 text-right text-sm font-medium text-muted-foreground">Stock</th>
                    <th className="px-3 py-3 text-right text-sm font-medium text-muted-foreground">Seuil</th>
                    <th className="px-3 py-3 text-left text-sm font-medium text-muted-foreground">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVariants.map(({ product, variant, status }) => (
                    <tr key={`${product.id}:${variant.id}`} className="border-b hover:bg-accent/50">
                      <td className="px-3 py-3">
                        <p className="text-sm font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.category}</p>
                      </td>
                      <td className="px-3 py-3 text-sm">
                        {variant.size} / {variant.color} / {variant.material || 'Standard'}
                      </td>
                      <td className="px-3 py-3 text-sm">{variant.sku}</td>
                      <td className="px-3 py-3 text-right text-sm font-medium">{variant.stock}</td>
                      <td className="px-3 py-3 text-right text-sm">{variant.lowStockThreshold}</td>
                      <td className="px-3 py-3">
                        <Badge variant={status === 'out_of_stock' ? 'destructive' : status === 'low_stock' ? 'outline' : 'default'}>
                          {status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <PackagePlus size={18} />
            <h3>Ajustement manuel</h3>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Produit</Label>
              <Select value={adjustment.productId} onValueChange={updateAdjustmentProduct}>
                <SelectTrigger><SelectValue placeholder="Choisir un produit" /></SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Variante</Label>
              <Select value={adjustment.variantId} onValueChange={(variantId) => setAdjustment((prev) => ({ ...prev, variantId }))}>
                <SelectTrigger><SelectValue placeholder="Choisir une variante" /></SelectTrigger>
                <SelectContent>
                  {(selectedProduct?.variants || []).map((variant) => (
                    <SelectItem key={variant.id} value={variant.id}>
                      {variant.size}/{variant.color}/{variant.material || 'Standard'} - {variant.sku}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={adjustment.type} onValueChange={(type) => setAdjustment((prev) => ({ ...prev, type }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {adjustmentTypes.map((type) => (
                    <SelectItem key={type} value={type}>{movementLabel(type)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantite</Label>
              <Input type="number" value={adjustment.quantity} onChange={(event) => setAdjustment((prev) => ({ ...prev, quantity: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Raison</Label>
              <Input value={adjustment.reason} onChange={(event) => setAdjustment((prev) => ({ ...prev, reason: event.target.value }))} />
            </div>
            <Button className="w-full" onClick={() => void submitAdjustment()} disabled={saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer mouvement'}
            </Button>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex items-center gap-2 lg:w-56">
            <History size={18} />
            <h3>Mouvements</h3>
          </div>
          <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Produit</Label>
              <Select value={movementProductFilter} onValueChange={setMovementProductFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={movementTypeFilter} onValueChange={setMovementTypeFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {MOVEMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{movementLabel(type)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Depuis</Label>
              <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Jusqu'a</Label>
              <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b">
              <tr>
                <th className="px-3 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
                <th className="px-3 py-3 text-left text-sm font-medium text-muted-foreground">Type</th>
                <th className="px-3 py-3 text-left text-sm font-medium text-muted-foreground">Produit</th>
                <th className="px-3 py-3 text-left text-sm font-medium text-muted-foreground">Variante</th>
                <th className="px-3 py-3 text-right text-sm font-medium text-muted-foreground">Quantite</th>
                <th className="px-3 py-3 text-left text-sm font-medium text-muted-foreground">Raison</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">Aucun mouvement trouve.</td></tr>
              ) : movements.map((movement) => {
                const product = products.find((entry) => entry.id === movement.productId);
                const variant = product?.variants?.find((entry) => entry.id === movement.variantId);
                return (
                  <tr key={movement.id} className="border-b hover:bg-accent/50">
                    <td className="px-3 py-3 text-sm">{String(movement.createdAt || '').slice(0, 10)}</td>
                    <td className="px-3 py-3"><Badge variant="outline">{movementLabel(movement.type)}</Badge></td>
                    <td className="px-3 py-3 text-sm">{product?.name || movement.productId}</td>
                    <td className="px-3 py-3 text-sm">{variant ? `${variant.size}/${variant.color}/${variant.material || 'Standard'}` : movement.variantId || '-'}</td>
                    <td className={`px-3 py-3 text-right text-sm font-medium ${movement.quantity < 0 ? 'text-destructive' : 'text-green-600'}`}>{movement.quantity}</td>
                    <td className="px-3 py-3 text-sm text-muted-foreground">{movement.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
