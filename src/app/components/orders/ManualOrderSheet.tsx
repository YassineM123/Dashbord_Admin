import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Trash2, Search } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { createManualOrderApi, fetchProductsApi, ManualOrderLineInput, ManualOrderPayload, ProductRecord } from '../../services/api';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { Textarea } from '../ui/textarea';

interface ManualOrderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ManualOrderLineDraft = ManualOrderLineInput & {
  id: string;
};

type DraftState = {
  customerName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  country: string;
  customerSource: string;
  customerNote: string;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  discount: string;
  deliveryFee: string;
  deliveryType: string;
  deliveryCompanyName: string;
  driverName: string;
  driverPhone: string;
  trackingNumber: string;
  deliveryStatus: string;
  internalNote: string;
};

const sourceOptions = ['Facebook', 'Instagram', 'WhatsApp', 'Phone', 'Store', 'Manual'];
const paymentMethodOptions = ['Cash on delivery', 'Paid online', 'Bank transfer', 'Other'];
const paymentStatusOptions = ['Unpaid', 'Paid', 'Cash on Delivery'];
const orderStatusOptions = ['New', 'Confirmed', 'Preparing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];
const deliveryTypeOptions = ['Home delivery', 'Pickup', 'Delivery company'];
const deliveryStatusOptions = ['Waiting', 'Assigned', 'Picked up', 'On the way', 'Delivered', 'Failed', 'Returned'];

function createLineDraft(product: ProductRecord): ManualOrderLineDraft {
  const variant = product.variants?.[0];
  return {
    id: `line_${Math.random().toString(36).slice(2, 8)}`,
    productId: product.id,
    variantId: variant?.id || '',
    quantity: 1,
    unitPrice: Number(product.price || 0),
    size: variant?.size || '',
    color: variant?.color || '',
    material: variant?.material || '',
  };
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value || 0);
}

function defaultDraft(): DraftState {
  return {
    customerName: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    country: 'Tunisia',
    customerSource: 'Manual',
    customerNote: '',
    paymentMethod: 'Cash on delivery',
    paymentStatus: 'Unpaid',
    orderStatus: 'New',
    discount: '0',
    deliveryFee: '0',
    deliveryType: 'Home delivery',
    deliveryCompanyName: '',
    driverName: '',
    driverPhone: '',
    trackingNumber: '',
    deliveryStatus: 'Waiting',
    internalNote: '',
  };
}

export function ManualOrderSheet({ open, onOpenChange }: ManualOrderSheetProps) {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [draft, setDraft] = useState<DraftState>(defaultDraft());
  const [lines, setLines] = useState<ManualOrderLineDraft[]>([]);
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

    const loadProducts = async () => {
      try {
        const rows = await fetchProductsApi();
        if (!active) {
          return;
        }
        setProducts(rows);
        if (rows.length) {
          setLines([createLineDraft(rows[0])]);
        } else {
          setLines([]);
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
    const query = productSearch.toLowerCase();
    if (!query) {
      return true;
    }
    return [product.name, product.sku, product.category].some((value) => String(value || '').toLowerCase().includes(query));
  });

  const subtotal = lines.reduce((sum, line) => sum + Number(line.unitPrice || 0) * Number(line.quantity || 0), 0);
  const discount = Number(draft.discount || 0);
  const deliveryFee = Number(draft.deliveryFee || 0);
  const total = Math.max(0, subtotal - discount + deliveryFee);

  const updateLine = (lineId: string, patch: Partial<ManualOrderLineDraft>) => {
    setLines((current) => current.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  };

  const updateLineProduct = (lineId: string, productId: string) => {
    const product = products.find((entry) => entry.id === productId);
    if (!product) {
      return;
    }
    const variant = product.variants?.[0];
    updateLine(lineId, {
      productId: product.id,
      variantId: variant?.id || '',
      quantity: 1,
      unitPrice: Number(product.price || 0),
      size: variant?.size || '',
      color: variant?.color || '',
      material: variant?.material || '',
    });
  };

  const updateLineVariant = (lineId: string, variantId: string) => {
    const line = lines.find((entry) => entry.id === lineId);
    if (!line) {
      return;
    }
    const product = products.find((entry) => entry.id === line.productId);
    const variant = product?.variants?.find((entry) => entry.id === variantId);
    if (!variant) {
      return;
    }
    updateLine(lineId, {
      variantId: variant.id,
      size: variant.size,
      color: variant.color,
      material: variant.material,
    });
  };

  const addLine = () => {
    const product = filteredProducts[0] || products[0];
    if (!product) {
      return;
    }
    setLines((current) => [...current, createLineDraft(product)]);
  };

  const removeLine = (lineId: string) => {
    setLines((current) => (current.length > 1 ? current.filter((line) => line.id !== lineId) : current));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (!lines.length) {
        throw new Error('Add at least one product before saving.');
      }

      const payload: ManualOrderPayload = {
        customer: {
          name: draft.customerName.trim(),
          phone: draft.phone.trim(),
          email: draft.email.trim() || undefined,
          address: draft.address.trim(),
          city: draft.city.trim(),
          country: draft.country.trim(),
          source: draft.customerSource,
          note: draft.customerNote.trim() || undefined,
        },
        items: lines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId,
          quantity: Number(line.quantity || 1),
          unitPrice: Number(line.unitPrice || 0),
          size: line.size,
          color: line.color,
          material: line.material,
        })),
        discount,
        deliveryFee,
        paymentMethod: draft.paymentMethod,
        paymentStatus: draft.paymentStatus,
        status: draft.orderStatus,
        deliveryType: draft.deliveryType,
        deliveryCompanyName: draft.deliveryCompanyName.trim() || undefined,
        driverName: draft.driverName.trim() || undefined,
        driverPhone: draft.driverPhone.trim() || undefined,
        trackingNumber: draft.trackingNumber.trim() || undefined,
        deliveryStatus: draft.deliveryStatus,
        internalNote: draft.internalNote.trim() || undefined,
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

  const productById = (productId: string) => products.find((product) => product.id === productId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-5xl">
        <SheetHeader>
          <SheetTitle>New Manual Order</SheetTitle>
          <SheetDescription>Create an order from Facebook, Instagram, WhatsApp, phone, or in-store sales.</SheetDescription>
        </SheetHeader>

        <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
          {errorMessage && <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{errorMessage}</Card>}
          {successMessage && <Card className="border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-700">{successMessage}</Card>}

          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">1. Customer</h3>
              <p className="text-sm text-muted-foreground">Capture the buyer and the source channel.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customerName">Customer name</Label>
                <Input id="customerName" value={draft.customerName} onChange={(event) => setDraft((current) => ({ ...current, customerName: event.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone number</Label>
                <Input id="phone" value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerSource">Customer source</Label>
                <Select value={draft.customerSource} onValueChange={(value) => setDraft((current) => ({ ...current, customerSource: value }))}>
                  <SelectTrigger id="customerSource">
                    <SelectValue placeholder="Select a source" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" value={draft.address} onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" value={draft.city} onChange={(event) => setDraft((current) => ({ ...current, city: event.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input id="country" value={draft.country} onChange={(event) => setDraft((current) => ({ ...current, country: event.target.value }))} required />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="customerNote">Customer note</Label>
                <Textarea id="customerNote" value={draft.customerNote} onChange={(event) => setDraft((current) => ({ ...current, customerNote: event.target.value }))} placeholder="Any context from the conversation or phone call" />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">2. Products</h3>
              <p className="text-sm text-muted-foreground">Search products, then add the selected variants to the order.</p>
            </div>

            <Card className="p-4 space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Search products by name, SKU, or category"
                    className="pl-9"
                  />
                </div>
                <Button type="button" variant="outline" className="gap-2" onClick={addLine} disabled={!products.length || isLoadingProducts}>
                  <Plus size={16} />
                  Add product
                </Button>
              </div>

              {isLoadingProducts ? (
                <p className="text-sm text-muted-foreground">Loading products...</p>
              ) : !products.length ? (
                <p className="text-sm text-muted-foreground">No products available.</p>
              ) : (
                <div className="space-y-4">
                  {lines.map((line, index) => {
                    const product = productById(line.productId) || filteredProducts[0] || products[0];
                    const variants = product?.variants || [];
                    return (
                      <div key={line.id} className="rounded-lg border p-4 space-y-4">
                        <div className="flex items-center justify-between gap-4">
                          <h4 className="font-medium">Product {index + 1}</h4>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(line.id)} disabled={lines.length === 1} className="gap-2">
                            <Trash2 size={14} />
                            Remove
                          </Button>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                          <div className="space-y-2 xl:col-span-2">
                            <Label>Product</Label>
                            <Select value={line.productId} onValueChange={(value) => updateLineProduct(line.id, value)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a product" />
                              </SelectTrigger>
                              <SelectContent>
                                {products.map((productOption) => (
                                  <SelectItem key={productOption.id} value={productOption.id}>
                                    {productOption.name} - {productOption.sku || productOption.id}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Variant</Label>
                            <Select value={line.variantId} onValueChange={(value) => updateLineVariant(line.id, value)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a variant" />
                              </SelectTrigger>
                              <SelectContent>
                                {variants.map((variant) => (
                                  <SelectItem key={variant.id} value={variant.id}>
                                    {variant.size} / {variant.color} / {variant.material || 'Standard'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Quantity</Label>
                            <Input
                              type="number"
                              min={1}
                              value={line.quantity}
                              onChange={(event) => updateLine(line.id, { quantity: Math.max(1, Number(event.target.value || 1)) })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Unit price</Label>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={line.unitPrice}
                              onChange={(event) => updateLine(line.id, { unitPrice: Math.max(0, Number(event.target.value || 0)) })}
                            />
                          </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-3 text-sm text-muted-foreground">
                          <p>Size: {line.size || '-'}</p>
                          <p>Color: {line.color || '-'}</p>
                          <p>Material: {line.material || '-'}</p>
                        </div>
                        <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                          <span>Line total</span>
                          <span className="font-medium">{money(Number(line.quantity || 0) * Number(line.unitPrice || 0))}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">3. Payment</h3>
              <p className="text-sm text-muted-foreground">Set the payment details and overall status.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                <Label>Payment status</Label>
                <Select value={draft.paymentStatus} onValueChange={(value) => setDraft((current) => ({ ...current, paymentStatus: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentStatusOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Order status</Label>
                <Select value={draft.orderStatus} onValueChange={(value) => setDraft((current) => ({ ...current, orderStatus: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {orderStatusOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Discount</Label>
                <Input type="number" min={0} step="0.01" value={draft.discount} onChange={(event) => setDraft((current) => ({ ...current, discount: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Delivery fee</Label>
                <Input type="number" min={0} step="0.01" value={draft.deliveryFee} onChange={(event) => setDraft((current) => ({ ...current, deliveryFee: event.target.value }))} />
              </div>
            </div>
            <div className="flex flex-wrap gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
              <span>Subtotal: {money(subtotal)}</span>
              <span>Discount: {money(discount)}</span>
              <span>Delivery: {money(deliveryFee)}</span>
              <span className="font-semibold">Total: {money(total)}</span>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">4. Delivery</h3>
              <p className="text-sm text-muted-foreground">Add the handoff details if the order needs shipping.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label>Delivery type</Label>
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
              <div className="space-y-2">
                <Label>Delivery company name</Label>
                <Input value={draft.deliveryCompanyName} onChange={(event) => setDraft((current) => ({ ...current, deliveryCompanyName: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Driver name</Label>
                <Input value={draft.driverName} onChange={(event) => setDraft((current) => ({ ...current, driverName: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Driver phone</Label>
                <Input value={draft.driverPhone} onChange={(event) => setDraft((current) => ({ ...current, driverPhone: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Tracking number</Label>
                <Input value={draft.trackingNumber} onChange={(event) => setDraft((current) => ({ ...current, trackingNumber: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Delivery status</Label>
                <Select value={draft.deliveryStatus} onValueChange={(value) => setDraft((current) => ({ ...current, deliveryStatus: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {deliveryStatusOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">5. Notes</h3>
              <p className="text-sm text-muted-foreground">Add internal notes for the team.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="internalNote">Internal note</Label>
              <Textarea id="internalNote" value={draft.internalNote} onChange={(event) => setDraft((current) => ({ ...current, internalNote: event.target.value }))} placeholder="Add call context, next steps, or special instructions" />
            </div>
          </section>

          <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isLoadingProducts || !lines.length} className="gap-2">
              {isSubmitting ? 'Saving...' : 'Save manual order'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
