import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, CheckCircle2, Loader2, Package2, ShoppingBag, User } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { createManualOrderApi, fetchProductsApi, ManualOrderPayload, ProductRecord } from '../../services/api';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';

interface SimpleManualOrderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DraftState = {
  customerName: string;
  phone: string;
  address: string;
  quantity: number;
  paymentMethod: string;
  deliveryType: string;
  confirmOrder: boolean;
};

const paymentMethodOptions = ['Cash on delivery', 'Paid online', 'Bank transfer', 'Other'];
const deliveryTypeOptions = ['Home delivery', 'Pickup', 'Delivery company'];

function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function defaultDraft(): DraftState {
  return {
    customerName: '',
    phone: '',
    address: '',
    quantity: 1,
    paymentMethod: 'Cash on delivery',
    deliveryType: 'Home delivery',
    confirmOrder: true,
  };
}

function paymentStatusFromMethod(method: string) {
  if (method === 'Cash on delivery') {
    return 'Cash on Delivery';
  }
  if (method === 'Paid online' || method === 'Bank transfer') {
    return 'Paid';
  }
  return 'Unpaid';
}

export function SimpleManualOrderSheet({ open, onOpenChange }: SimpleManualOrderSheetProps) {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [draft, setDraft] = useState<DraftState>(defaultDraft());
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;
    setIsLoadingProducts(true);
    setErrorMessage('');
    setSuccessMessage('');
    setDraft(defaultDraft());
    setProductSearch('');
    setSelectedProductId('');
    setSelectedVariantId('');

    const loadProducts = async () => {
      try {
        const rows = await fetchProductsApi();
        if (!active) {
          return;
        }
        setProducts(rows);
        const firstProduct = rows[0];
        if (firstProduct) {
          setSelectedProductId(firstProduct.id);
          setSelectedVariantId(firstProduct.variants?.[0]?.id || '');
        }
      } catch (_error) {
        if (active) {
          setErrorMessage('Unable to load products. Please try again.');
        }
      } finally {
        if (active) {
          setIsLoadingProducts(false);
        }
      }
    };

    loadProducts();

    return () => {
      active = false;
    };
  }, [open]);

  const filteredProducts = products.filter((product) => {
    const query = productSearch.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return [product.name, product.sku, product.category].some((value) => String(value || '').toLowerCase().includes(query));
  });

  const selectedProduct = products.find((product) => product.id === selectedProductId) || null;
  const variants = selectedProduct?.variants || [];
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) || variants[0] || null;
  const unitPrice = Number(selectedProduct?.price || 0);
  const total = Math.max(0, unitPrice * Number(draft.quantity || 1));
  const canSubmit = Boolean(selectedProduct && draft.customerName.trim() && draft.phone.trim() && draft.address.trim() && draft.quantity > 0);
  const productOptions = selectedProduct && !filteredProducts.some((product) => product.id === selectedProduct.id)
    ? [selectedProduct, ...filteredProducts]
    : filteredProducts;

  useEffect(() => {
    if (!selectedProduct) {
      return;
    }
    if (!variants.length) {
      setSelectedVariantId('');
      return;
    }
    if (!variants.some((variant) => variant.id === selectedVariantId)) {
      setSelectedVariantId(variants[0].id);
    }
  }, [selectedProduct, selectedVariantId, variants]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedProduct) {
      setErrorMessage('Select a product before saving.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const payload: ManualOrderPayload = {
        customer: {
          name: draft.customerName.trim(),
          phone: draft.phone.trim(),
          address: draft.address.trim(),
          city: '',
          country: 'Tunisia',
          source: 'Manual',
        },
        items: [
          {
            productId: selectedProduct.id,
            variantId: selectedVariant?.id || undefined,
            quantity: Number(draft.quantity || 1),
            unitPrice,
            size: selectedVariant?.size,
            color: selectedVariant?.color,
            material: selectedVariant?.material,
          },
        ],
        discount: 0,
        deliveryFee: 0,
        paymentMethod: draft.paymentMethod,
        paymentStatus: paymentStatusFromMethod(draft.paymentMethod),
        status: draft.confirmOrder ? 'Confirmed' : 'New',
        deliveryType: draft.deliveryType,
      };

      const created = await createManualOrderApi(payload);
      setSuccessMessage(`Manual order ${created.id} created successfully.`);
      toast.success('Manual order created');
      onOpenChange(false);
      navigate(`/admin/orders/${encodeURIComponent(created.id)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create manual order.';
      setErrorMessage(message);
      toast.error('Failed to create manual order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-6xl">
        <SheetHeader>
          <SheetTitle>New Manual Order</SheetTitle>
          <SheetDescription>Fast order entry for non-technical sellers. Customer creation, notifications, and order details are handled automatically.</SheetDescription>
        </SheetHeader>

        <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
          {errorMessage && <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{errorMessage}</Card>}
          {successMessage && <Card className="border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-700">{successMessage}</Card>}

          <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
            <div className="space-y-6">
              <Card className="border-border/70 p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2 text-primary">
                    <User size={18} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Customer</h3>
                    <p className="text-sm text-muted-foreground">Enter the buyer name, phone, and address.</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="customerName">Customer name</Label>
                    <Input
                      id="customerName"
                      value={draft.customerName}
                      onChange={(event) => setDraft((current) => ({ ...current, customerName: event.target.value }))}
                      placeholder="e.g. Sara Ben Ali"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone number</Label>
                    <Input
                      id="phone"
                      value={draft.phone}
                      onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
                      placeholder="e.g. +216 12 345 678"
                      required
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={draft.address}
                      onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))}
                      placeholder="Street, city, or landmark"
                      required
                    />
                  </div>
                </div>
              </Card>

              <Card className="border-border/70 p-5 space-y-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2 text-primary">
                    <ShoppingBag size={18} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Product</h3>
                    <p className="text-sm text-muted-foreground">Choose the product, variant, and quantity.</p>
                  </div>
                </div>

                {isLoadingProducts ? (
                  <div className="flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    <Loader2 size={16} className="animate-spin" />
                    Loading products...
                  </div>
                ) : !products.length ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No products available.</div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="productSearch">Search product</Label>
                      <Input
                        id="productSearch"
                        value={productSearch}
                        onChange={(event) => setProductSearch(event.target.value)}
                        placeholder="Search by name, SKU, or category"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label>Product</Label>
                      <Select
                        value={selectedProductId}
                        onValueChange={(value) => {
                          setSelectedProductId(value);
                          const product = products.find((entry) => entry.id === value);
                          setSelectedVariantId(product?.variants?.[0]?.id || '');
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a product" />
                        </SelectTrigger>
                        <SelectContent>
                          {productOptions.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} {product.sku ? `- ${product.sku}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label>Variant</Label>
                      <Select value={selectedVariantId} onValueChange={setSelectedVariantId} disabled={!variants.length}>
                        <SelectTrigger>
                          <SelectValue placeholder={variants.length ? 'Select a variant' : 'No variants available'} />
                        </SelectTrigger>
                        <SelectContent>
                          {variants.map((variant) => (
                            <SelectItem key={variant.id} value={variant.id}>
                              {variant.size || 'One size'} / {variant.color || 'Default'} / {variant.material || 'Standard'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantity</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min={1}
                        step={1}
                        value={draft.quantity}
                        onChange={(event) => setDraft((current) => ({ ...current, quantity: Math.max(1, Number(event.target.value || 1)) }))}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Unit price</Label>
                      <Input value={money(unitPrice)} readOnly className="bg-muted/40" />
                    </div>

                    <div className="md:col-span-2 rounded-lg border bg-muted/30 p-4 text-sm">
                      <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                        <span>{selectedProduct?.name || 'Select a product'}</span>
                        {selectedVariant && (
                          <Badge variant="secondary">
                            {selectedVariant.size || 'One size'} / {selectedVariant.color || 'Default'}
                          </Badge>
                        )}
                        <span>Qty: {draft.quantity}</span>
                      </div>
                      <Separator className="my-3" />
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Calculated total</span>
                        <span className="text-lg font-semibold">{money(total)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              <Card className="border-border/70 p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2 text-primary">
                    <Package2 size={18} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Checkout</h3>
                    <p className="text-sm text-muted-foreground">Set the payment and delivery method.</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Payment method</Label>
                    <Select value={draft.paymentMethod} onValueChange={(value) => setDraft((current) => ({ ...current, paymentMethod: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMethodOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Delivery method</Label>
                    <Select value={draft.deliveryType} onValueChange={(value) => setDraft((current) => ({ ...current, deliveryType: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {deliveryTypeOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-3 rounded-lg border p-4">
                  <Checkbox
                    id="confirmOrder"
                    checked={draft.confirmOrder}
                    onCheckedChange={(checked) => setDraft((current) => ({ ...current, confirmOrder: checked === true }))}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="confirmOrder" className="text-sm font-medium">
                      Confirm order now
                    </Label>
                    <p className="text-sm text-muted-foreground">Confirmed orders reduce stock automatically.</p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="sticky top-6 border-border/70 p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2 text-primary">
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Order summary</h3>
                    <p className="text-sm text-muted-foreground">Quick check before saving.</p>
                  </div>
                </div>

                <div className="mt-5 space-y-4 text-sm">
                  <div className="rounded-lg bg-muted/40 p-4 space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Customer</span>
                      <span className="font-medium text-right">{draft.customerName || 'Not set'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Phone</span>
                      <span className="font-medium text-right">{draft.phone || 'Not set'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Product</span>
                      <span className="font-medium text-right">{selectedProduct?.name || 'Not selected'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Variant</span>
                      <span className="font-medium text-right">{selectedVariant ? `${selectedVariant.size || 'One size'} / ${selectedVariant.color || 'Default'}` : 'Not selected'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                    <span className="text-muted-foreground">Total</span>
                    <span className="text-xl font-semibold">{money(total)}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 size={16} />
                    Customer creation, notification, and details page navigation happen automatically.
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isLoadingProducts || !canSubmit} className="gap-2">
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              {isSubmitting ? 'Saving...' : 'Save order'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
