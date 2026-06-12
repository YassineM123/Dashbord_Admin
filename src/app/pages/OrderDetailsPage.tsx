import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, FileText, Truck, User, Package, CreditCard, History, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { StatusBadge } from '../components/admin/StatusBadge';
import { fetchOrderByIdApi, generateDeliveryNoteApi, generateInvoiceApi, OrderRecord } from '../services/api';

function money(value?: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(value || 0);
}

function formatDate(value?: string) {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function OrderDetailsPage() {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [isGeneratingDeliveryNote, setIsGeneratingDeliveryNote] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;

    const loadOrder = async () => {
      try {
        const orderId = params.id ? decodeURIComponent(params.id) : '';
        const row = await fetchOrderByIdApi(orderId);
        if (active) {
          setOrder(row);
          setErrorMessage('');
        }
      } catch (_error) {
        if (active) {
          setErrorMessage('Unable to load the order details.');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    loadOrder();
    return () => {
      active = false;
    };
  }, [params.id]);

  const handleGenerateInvoice = async () => {
    if (!order) {
      return;
    }
    setIsGeneratingInvoice(true);
    try {
      const invoice = await generateInvoiceApi(order.id);
      toast.success(`Invoice ${invoice.number} generated`);
      navigate(`/admin/invoices?invoice=${encodeURIComponent(invoice.id)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to generate invoice');
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  const handleGenerateDeliveryNote = async () => {
    if (!order) {
      return;
    }
    setIsGeneratingDeliveryNote(true);
    try {
      const note = await generateDeliveryNoteApi(order.id);
      toast.success(`Delivery note ${note.number} generated`);
      navigate(`/admin/delivery-notes?note=${encodeURIComponent(note.id)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to generate delivery note');
    } finally {
      setIsGeneratingDeliveryNote(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Button variant="ghost" className="mb-3 gap-2 px-0" onClick={() => navigate('/admin/orders')}>
            <ArrowLeft size={16} />
            Back to orders
          </Button>
          <h1>Order details</h1>
          <p className="text-muted-foreground">Review the full order, linked customer, products, delivery, and timeline.</p>
        </div>
        {order && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={handleGenerateInvoice} disabled={isGeneratingInvoice}>
              <FileText size={16} />
              {isGeneratingInvoice ? 'Generating invoice...' : 'Generate invoice'}
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleGenerateDeliveryNote} disabled={isGeneratingDeliveryNote}>
              <Truck size={16} />
              {isGeneratingDeliveryNote ? 'Generating note...' : 'Generate delivery note'}
            </Button>
          </div>
        )}
      </div>

      {errorMessage && <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{errorMessage}</Card>}

      {isLoading ? (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Loading order details...</p>
        </Card>
      ) : order ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="p-5 space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Order</p>
                  <h2 className="text-2xl font-semibold">{order.id}</h2>
                  <p className="text-sm text-muted-foreground">Created at {formatDate(order.date)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge
                    status={
                      order.status === 'Confirmed'
                        ? 'Confirmed'
                        : order.status === 'Preparing'
                          ? 'Preparing'
                          : order.status === 'Shipped'
                            ? 'Shipped'
                            : order.status === 'Delivered'
                              ? 'Delivered'
                              : order.status === 'Cancelled'
                                ? 'Cancelled'
                                : order.status === 'Returned'
                                  ? 'Returned'
                                  : 'New'
                    }
                    type={order.status === 'Delivered' ? 'success' : order.status === 'Cancelled' ? 'danger' : order.status === 'Shipped' ? 'info' : 'warning'}
                  />
                  <StatusBadge
                    status={order.deliveryStatus || 'Waiting'}
                    type={order.deliveryStatus === 'Delivered' ? 'success' : order.deliveryStatus === 'Failed' ? 'danger' : order.deliveryStatus === 'On the way' ? 'info' : 'warning'}
                  />
                </div>
              </div>
            </Card>

            <Card className="p-5 space-y-4">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <User size={18} />
                Customer
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{order.customer}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Source</p>
                  <p className="font-medium">{order.customerSource || order.source || 'Manual'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{order.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{order.email || '-'}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{order.address || '-'} {order.city ? `, ${order.city}` : ''} {order.country ? `, ${order.country}` : ''}</p>
                </div>
                {order.customerNote && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-muted-foreground">Customer note</p>
                    <p className="font-medium">{order.customerNote}</p>
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-5 space-y-4">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <Package size={18} />
                Products
              </h3>
              <div className="space-y-3">
                {(order.lineItems || []).map((item) => (
                  <div key={item.id} className="rounded-lg border p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.size || 'Default'} / {item.color || 'Default'} / {item.material || 'Standard'}
                      </p>
                      <p className="text-sm text-muted-foreground">SKU: {item.sku || '-'}</p>
                    </div>
                    <div className="text-sm md:text-right">
                      <p>Qty: {item.quantity}</p>
                      <p>Unit: {money(item.unitPrice)}</p>
                      <p className="font-semibold">Line total: {money(item.total)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5 space-y-4">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <History size={18} />
                Timeline
              </h3>
              <div className="space-y-3">
                {(order.timeline || []).map((event) => (
                  <div key={event.id} className="flex gap-3 rounded-lg border p-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                    <div>
                      <p className="font-medium">{event.label || event.type || 'Event'}</p>
                      <p className="text-sm text-muted-foreground">{formatDate(event.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-5 space-y-4">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <CreditCard size={18} />
                Payment
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Method</span>
                  <span className="font-medium">{order.paymentMethod || order.payment || '-'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium">{order.paymentStatus || order.payment || '-'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="font-medium">{money(order.discount || 0)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Delivery fee</span>
                  <span className="font-medium">{money(order.deliveryFee || 0)}</span>
                </div>
                <div className="flex justify-between gap-4 border-t pt-3 text-base">
                  <span className="font-semibold">Total</span>
                  <span className="font-semibold">{money(order.total || order.amount)}</span>
                </div>
              </div>
            </Card>

            <Card className="p-5 space-y-4">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <MapPin size={18} />
                Delivery
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">{order.deliveryType || 'Home delivery'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Company</span>
                  <span className="font-medium">{order.deliveryCompanyName || order.courier || '-'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Driver</span>
                  <span className="font-medium">{order.driverName || '-'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Driver phone</span>
                  <span className="font-medium">{order.driverPhone || '-'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Tracking</span>
                  <span className="font-medium">{order.trackingNumber || order.tracking || '-'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium">{order.deliveryStatus || order.delivery || '-'}</span>
                </div>
              </div>
            </Card>

            {order.internalNotes && order.internalNotes.length > 0 && (
              <Card className="p-5 space-y-4">
                <h3 className="text-lg font-semibold">Internal notes</h3>
                <div className="space-y-2 text-sm">
                  {order.internalNotes.map((note) => (
                    <div key={note.id} className="rounded-lg border p-3">
                      <p>{note.text}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDate(note.createdAt)}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card className="p-5 space-y-3">
              <h3 className="text-lg font-semibold">Actions</h3>
              <Button variant="outline" className="w-full gap-2" onClick={handleGenerateInvoice} disabled={isGeneratingInvoice}>
                <FileText size={16} />
                {isGeneratingInvoice ? 'Generating invoice...' : 'Generate invoice'}
              </Button>
              <Button variant="outline" className="w-full gap-2" onClick={handleGenerateDeliveryNote} disabled={isGeneratingDeliveryNote}>
                <Truck size={16} />
                {isGeneratingDeliveryNote ? 'Generating note...' : 'Generate delivery note'}
              </Button>
            </Card>
          </div>
        </div>
      ) : (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Order not found.</p>
        </Card>
      )}
    </div>
  );
}
