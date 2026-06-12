import { AppError } from '../core/errors.mjs';

export const ORDER_STATUSES = ['New', 'Confirmed', 'Preparing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];
export const PAYMENT_STATUSES = ['Unpaid', 'Paid', 'Cash on Delivery', 'Refunded'];
export const DELIVERY_STATUSES = ['Waiting', 'Assigned', 'Picked up', 'On the way', 'Delivered', 'Failed', 'Returned'];
export const STOCK_MOVEMENT_TYPES = [
  'stock_added',
  'stock_removed',
  'order_reserved',
  'order_confirmed',
  'order_cancelled',
  'return_received',
  'manual_adjustment',
];
export const CUSTOMER_SEGMENTS = ['New', 'VIP', 'Repeat Buyer', 'Inactive'];
export const CAMPAIGN_STATUSES = ['Draft', 'Scheduled', 'Sent'];
export const AD_PLATFORMS = ['Meta', 'Google', 'Manual'];
export const SALES_CHANNEL_PROVIDERS = ['manual', 'shopify', 'woocommerce', 'prestashop'];

function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function now() {
  return new Date().toISOString();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeOrderStatus(value) {
  const map = {
    pending: 'New',
    paid: 'Confirmed',
    shipped: 'Shipped',
    delivered: 'Delivered',
    canceled: 'Cancelled',
    cancelled: 'Cancelled',
    returned: 'Returned',
  };
  const normalized = String(value || '').trim();
  return ORDER_STATUSES.includes(normalized) ? normalized : map[normalized.toLowerCase()] || 'New';
}

function normalizePaymentStatus(value) {
  const map = {
    pending: 'Unpaid',
    unpaid: 'Unpaid',
    paid: 'Paid',
    cb: 'Paid',
    card: 'Paid',
    cod: 'Cash on Delivery',
    refunded: 'Refunded',
  };
  const normalized = String(value || '').trim();
  return PAYMENT_STATUSES.includes(normalized) ? normalized : map[normalized.toLowerCase()] || 'Unpaid';
}

function normalizeDeliveryStatus(value) {
  const map = {
    not_shipped: 'Waiting',
    pending: 'Waiting',
    in_transit: 'On the way',
    delivered: 'Delivered',
    failed: 'Failed',
    returned: 'Returned',
  };
  const normalized = String(value || '').trim();
  return DELIVERY_STATUSES.includes(normalized) ? normalized : map[normalized.toLowerCase()] || 'Waiting';
}

function legacyDeliveryStatus(value) {
  const normalized = normalizeDeliveryStatus(value);
  if (normalized === 'Delivered') return 'delivered';
  if (normalized === 'On the way' || normalized === 'Picked up') return 'in_transit';
  if (normalized === 'Failed') return 'failed';
  if (normalized === 'Returned') return 'returned';
  return 'pending';
}

function normalizeProduct(product) {
  const stock = Math.max(0, toNumber(product.stock, 0));
  const sku = String(product.sku || product.id || '').trim();
  const variants = Array.isArray(product.variants) && product.variants.length
    ? product.variants.map((variant, index) => ({
        id: String(variant.id || `${product.id || 'prd'}-v${index + 1}`),
        size: String(variant.size || 'Default'),
        color: String(variant.color || 'Default'),
        material: String(variant.material || 'Standard'),
        sku: String(variant.sku || sku || `${product.id || 'prd'}-${index + 1}`),
        stock: Math.max(0, toNumber(variant.stock, stock)),
        reserved: Math.max(0, toNumber(variant.reserved, 0)),
        lowStockThreshold: Math.max(0, toNumber(variant.lowStockThreshold, 5)),
      }))
    : [
        {
          id: `${product.id || createId('prd')}-default`,
          size: 'Default',
          color: 'Default',
          material: 'Standard',
          sku,
          stock,
          reserved: 0,
          lowStockThreshold: 5,
        },
      ];

  const totalStock = variants.reduce((sum, variant) => sum + toNumber(variant.stock, 0), 0);
  const minThreshold = variants.reduce((min, variant) => Math.min(min, toNumber(variant.lowStockThreshold, 5)), 5);
  const status = totalStock <= 0 ? 'out_of_stock' : totalStock <= minThreshold ? 'low_stock' : 'available';

  return {
    ...product,
    id: String(product.id || createId('prd')),
    name: String(product.name || 'Unnamed product'),
    sku,
    price: toNumber(product.price, 0),
    costPrice: toNumber(product.costPrice, Math.round(toNumber(product.price, 0) * 0.55 * 100) / 100),
    stock: totalStock,
    status,
    category: String(product.category || 'General'),
    active: product.active !== false,
    variants,
    updated: product.updated || now().slice(0, 10),
    image: product.image || '📦',
  };
}

function normalizeLineItem(item, products = []) {
  const productId = String(item.productId || item.id || '').trim();
  const product = products.find((entry) => String(entry.id) === productId) || null;
  const variantId = String(item.variantId || product?.variants?.[0]?.id || '').trim();
  const quantity = Math.max(1, Math.trunc(toNumber(item.quantity, 1)));
  const unitPrice = toNumber(item.unitPrice ?? item.price, product?.price || 0);
  const costPrice = toNumber(item.costPrice, product?.costPrice || 0);
  return {
    id: String(item.id || createId('li')),
    productId,
    variantId,
    name: String(item.name || product?.name || 'Product'),
    sku: String(item.sku || product?.sku || ''),
    size: String(item.size || product?.variants?.find((variant) => variant.id === variantId)?.size || ''),
    color: String(item.color || product?.variants?.find((variant) => variant.id === variantId)?.color || ''),
    material: String(item.material || product?.variants?.find((variant) => variant.id === variantId)?.material || ''),
    quantity,
    unitPrice,
    costPrice,
    total: Math.round(unitPrice * quantity * 100) / 100,
  };
}

function orderTotal(lineItems, deliveryFee = 0) {
  const subtotal = lineItems.reduce((sum, item) => sum + toNumber(item.total, 0), 0);
  return Math.round((subtotal + toNumber(deliveryFee, 0)) * 100) / 100;
}

function normalizeOrder(order, products = []) {
  const lineItems = Array.isArray(order.lineItems) && order.lineItems.length
    ? order.lineItems.map((item) => normalizeLineItem(item, products))
    : [];
  const deliveryFee = toNumber(order.deliveryFee, 0);
  const discount = Math.max(0, toNumber(order.discount ?? order.discountTotal, 0));
  const paymentStatus = normalizePaymentStatus(order.paymentStatus || order.payment);
  const status = normalizeOrderStatus(order.status);
  const deliveryStatus = normalizeDeliveryStatus(order.deliveryStatus || order.delivery);
  const subtotal = lineItems.reduce((sum, item) => sum + toNumber(item.total, 0), 0);
  const total = Math.max(0, Math.round((subtotal - discount + deliveryFee) * 100) / 100);
  return {
    ...order,
    id: String(order.id || createId('ord')),
    customerId: String(order.customerId || ''),
    customer: String(order.customer || order.customerName || 'Client'),
    email: String(order.email || ''),
    phone: String(order.phone || ''),
    address: String(order.address || ''),
    city: String(order.city || ''),
    country: String(order.country || 'Tunisia'),
    customerSource: String(order.customerSource || order.source || 'Manual'),
    status,
    paymentStatus,
    payment: paymentStatus,
    paymentMethod: String(order.paymentMethod || order.payment || paymentStatus),
    deliveryStatus,
    delivery: legacyDeliveryStatus(deliveryStatus),
    deliveryType: String(order.deliveryType || ''),
    deliveryCompanyName: String(order.deliveryCompanyName || order.company || ''),
    driverName: String(order.driverName || ''),
    driverPhone: String(order.driverPhone || ''),
    trackingNumber: String(order.trackingNumber || order.tracking || ''),
    deliveryId: String(order.deliveryId || ''),
    deliveryFee,
    discount,
    subtotal,
    amount: toNumber(order.amount, total),
    total: toNumber(order.total, toNumber(order.amount, total)),
    date: order.date || now(),
    source: String(order.source || 'Manual'),
    lineItems,
    internalNotes: Array.isArray(order.internalNotes) ? order.internalNotes : [],
    customerNote: String(order.customerNote || ''),
    internalNote: String(order.internalNote || ''),
    timeline: Array.isArray(order.timeline)
      ? order.timeline
      : [{ id: createId('evt'), type: 'created', label: 'Order created', timestamp: order.date || now() }],
    stockAction: order.stockAction || null,
  };
}

function normalizeCustomer(customer) {
  return {
    ...customer,
    id: String(customer.id || createId('cus')),
    name: String(customer.name || 'Customer'),
    email: String(customer.email || ''),
    phone: String(customer.phone || ''),
    address: String(customer.address || ''),
    city: String(customer.city || ''),
    country: String(customer.country || 'Tunisia'),
    source: String(customer.source || ''),
    status: String(customer.status || 'active'),
    tags: Array.isArray(customer.tags) ? customer.tags : [],
    notes: Array.isArray(customer.notes) ? customer.notes : customer.notes ? [{ id: createId('note'), text: String(customer.notes), createdAt: now() }] : [],
    reminders: Array.isArray(customer.reminders) ? customer.reminders : [],
    segment: CUSTOMER_SEGMENTS.includes(customer.segment) ? customer.segment : 'New',
  };
}

function computeCustomerStats(customer, orders) {
  const customerOrders = orders.filter((order) => {
    return (
      String(order.customerId || '') === String(customer.id) ||
      (!!customer.email && String(order.email || '').toLowerCase() === customer.email.toLowerCase()) ||
      (!!customer.phone && String(order.phone || '') === customer.phone)
    );
  });
  const completed = customerOrders.filter((order) => !['Cancelled', 'Returned'].includes(order.status));
  const totalSpent = completed.reduce((sum, order) => sum + toNumber(order.total ?? order.amount, 0), 0);
  const lastOrderDate = customerOrders
    .map((order) => new Date(order.date || 0))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => right.getTime() - left.getTime())[0];
  const inactiveDays = lastOrderDate ? Math.floor((Date.now() - lastOrderDate.getTime()) / 86_400_000) : Infinity;
  const segment =
    totalSpent >= 1000
      ? 'VIP'
      : completed.length >= 2
        ? 'Repeat Buyer'
        : inactiveDays > 90
          ? 'Inactive'
          : 'New';

  return {
    orders: customerOrders.length,
    orderHistory: customerOrders,
    totalSpent: Math.round(totalSpent * 100) / 100,
    lastOrderDate: lastOrderDate ? lastOrderDate.toISOString() : '',
    lastActivity: lastOrderDate ? lastOrderDate.toISOString().slice(0, 10) : customer.lastActivity || '',
    segment,
  };
}

function normalizeDelivery(delivery) {
  const status = normalizeDeliveryStatus(delivery.status || delivery.deliveryStatus || delivery.delivery);
  return {
    ...delivery,
    id: String(delivery.id || createId('del')),
    orderId: String(delivery.orderId || ''),
    customerId: String(delivery.customerId || ''),
    deliveryType: String(delivery.deliveryType || delivery.type || 'home delivery'),
    company: String(delivery.company || delivery.courier || ''),
    driverName: String(delivery.driverName || ''),
    driverPhone: String(delivery.driverPhone || ''),
    trackingNumber: String(delivery.trackingNumber || delivery.tracking || ''),
    deliveryFee: toNumber(delivery.deliveryFee || delivery.fee, 0),
    address: String(delivery.address || ''),
    city: String(delivery.city || ''),
    status,
    failedReason: String(delivery.failedReason || ''),
    timeline: Array.isArray(delivery.timeline) ? delivery.timeline : [],
    createdAt: delivery.createdAt || now(),
    updatedAt: delivery.updatedAt || delivery.deliveryUpdatedAt || now(),
  };
}

function normalizeInvoice(invoice) {
  return {
    ...invoice,
    id: String(invoice.id || createId('inv')),
    number: String(invoice.number || `INV-${Date.now().toString().slice(-6)}`),
    orderId: String(invoice.orderId || ''),
    customerId: String(invoice.customerId || ''),
    status: String(invoice.status || 'Draft'),
    subtotal: toNumber(invoice.subtotal, 0),
    deliveryFee: toNumber(invoice.deliveryFee, 0),
    total: toNumber(invoice.total, 0),
    costTotal: toNumber(invoice.costTotal, 0),
    grossMargin: toNumber(invoice.grossMargin, 0),
    paymentStatus: normalizePaymentStatus(invoice.paymentStatus),
    createdAt: invoice.createdAt || now(),
  };
}

function normalizeOrderPaymentMethod(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return 'Cash on delivery';
  const map = {
    cod: 'Cash on delivery',
    cash_on_delivery: 'Cash on delivery',
    'cash on delivery': 'Cash on delivery',
    paid_online: 'Paid online',
    'paid online': 'Paid online',
    bank_transfer: 'Bank transfer',
    'bank transfer': 'Bank transfer',
    other: 'Other',
  };
  return map[normalized.toLowerCase()] || normalized;
}

function normalizeManualOrderStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  const map = {
    new: 'New',
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    canceled: 'Cancelled',
    returned: 'Returned',
  };
  return map[normalized] || 'New';
}

function normalizeManualDeliveryStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  const map = {
    waiting: 'Waiting',
    assigned: 'Assigned',
    'picked up': 'Picked up',
    picked_up: 'Picked up',
    'on the way': 'On the way',
    on_the_way: 'On the way',
    delivered: 'Delivered',
    failed: 'Failed',
    returned: 'Returned',
  };
  return map[normalized] || 'Waiting';
}

function buildManualOrderTotals(lineItems, discount = 0, deliveryFee = 0) {
  const subtotal = Math.round(lineItems.reduce((sum, item) => sum + toNumber(item.total, 0), 0) * 100) / 100;
  const normalizedDiscount = Math.max(0, toNumber(discount, 0));
  const normalizedDeliveryFee = Math.max(0, toNumber(deliveryFee, 0));
  const total = Math.max(0, Math.round((subtotal - normalizedDiscount + normalizedDeliveryFee) * 100) / 100);
  return { subtotal, discount: normalizedDiscount, deliveryFee: normalizedDeliveryFee, total };
}

function findMatchingCustomer(customers, payload = {}) {
  const phone = String(payload.phone || '').trim();
  const email = String(payload.email || '').trim().toLowerCase();
  return (
    customers.find((customer) => {
      const customerPhone = String(customer.phone || '').trim();
      const customerEmail = String(customer.email || '').trim().toLowerCase();
      return (!!phone && customerPhone === phone) || (!!email && customerEmail === email);
    }) || null
  );
}

function normalizeAdCampaign(campaign) {
  const revenue = toNumber(campaign.revenue, 0);
  const budget = toNumber(campaign.budget, 0);
  return {
    ...campaign,
    id: String(campaign.id || createId('ad')),
    name: String(campaign.name || 'Campaign'),
    platform: AD_PLATFORMS.includes(campaign.platform) ? campaign.platform : 'Manual',
    objective: String(campaign.objective || 'Sales'),
    status: String(campaign.status || 'Active'),
    budget,
    impressions: Math.max(0, Math.trunc(toNumber(campaign.impressions, 0))),
    clicks: Math.max(0, Math.trunc(toNumber(campaign.clicks, 0))),
    leads: Math.max(0, Math.trunc(toNumber(campaign.leads, 0))),
    orders: Math.max(0, Math.trunc(toNumber(campaign.orders, 0))),
    revenue,
    roas: budget > 0 ? Math.round((revenue / budget) * 100) / 100 : 0,
  };
}

function normalizeMarketingCampaign(campaign) {
  return {
    ...campaign,
    id: String(campaign.id || createId('mkt')),
    name: String(campaign.name || 'Campaign'),
    channel: String(campaign.channel || 'Email'),
    segment: String(campaign.segment || 'All Customers'),
    subject: String(campaign.subject || ''),
    body: String(campaign.body || ''),
    status: CAMPAIGN_STATUSES.includes(campaign.status) ? campaign.status : 'Draft',
    scheduledAt: campaign.scheduledAt || '',
    sentAt: campaign.sentAt || '',
    createdAt: campaign.createdAt || now(),
  };
}

function normalizeSalesChannel(channel) {
  const provider = SALES_CHANNEL_PROVIDERS.includes(channel.provider) ? channel.provider : 'manual';
  return {
    ...channel,
    id: String(channel.id || createId('chn')),
    provider,
    name: String(channel.name || provider),
    enabled: channel.enabled !== false,
    status: String(channel.status || (provider === 'manual' ? 'connected' : 'disconnected')),
    credentialsMeta: channel.credentialsMeta && typeof channel.credentialsMeta === 'object' ? channel.credentialsMeta : {},
    lastSyncAt: channel.lastSyncAt || '',
    productSyncEnabled: channel.productSyncEnabled !== false,
    orderSyncEnabled: channel.orderSyncEnabled !== false,
    createdAt: channel.createdAt || now(),
  };
}

export function createEcommerceService(deps) {
  const {
    ordersRepo,
    productsRepo,
    customersRepo,
    deliveriesRepo,
    stockMovementsRepo,
    invoicesRepo,
    deliveryNotesRepo,
    expensesRepo,
    marketingCampaignsRepo,
    marketingTemplatesRepo,
    adCampaignsRepo,
    salesChannelsRepo,
    syncJobsRepo,
    conversationsRepo,
    leadsRepo,
    auditLogService,
    notificationService,
  } = deps;

  async function listProducts() {
    const rows = await productsRepo.list();
    return rows.map(normalizeProduct);
  }

  async function persistProducts(products) {
    return productsRepo.replaceAll(products.map(normalizeProduct));
  }

  async function recordStockMovement(context, movement) {
    const created = await stockMovementsRepo.create({
      id: createId('stk'),
      type: STOCK_MOVEMENT_TYPES.includes(movement.type) ? movement.type : 'manual_adjustment',
      productId: movement.productId,
      variantId: movement.variantId || '',
      quantity: Math.trunc(toNumber(movement.quantity, 0)),
      reason: String(movement.reason || ''),
      orderId: String(movement.orderId || ''),
      createdAt: now(),
      createdBy: context?.user?.id || 'system',
    });
    await auditLogService.record(context, 'stock.movement', 'stock', created.id, created);
    return created;
  }

  async function notifyLowStock(product) {
    const normalized = normalizeProduct(product);
    if (normalized.stock <= 0) {
      await notificationService.notify({
        type: 'warning',
        priority: 'high',
        title: 'Out of stock',
        message: `${normalized.name} is out of stock`,
        link: `/admin/stock?product=${encodeURIComponent(normalized.id)}`,
        entityType: 'product',
        entityId: normalized.id,
        dedupeKey: `out_of_stock:${normalized.id}`,
      });
    } else if (normalized.status === 'low_stock') {
      await notificationService.notify({
        type: 'warning',
        priority: 'medium',
        title: 'Low stock',
        message: `${normalized.name} stock is low (${normalized.stock})`,
        link: `/admin/stock?product=${encodeURIComponent(normalized.id)}`,
        entityType: 'product',
        entityId: normalized.id,
        dedupeKey: `low_stock:${normalized.id}:${normalized.stock}`,
      });
    }
  }

  async function applyOrderStock(context, order, actionType) {
    const products = await listProducts();
    const nextProducts = products.map((product) => ({ ...product, variants: product.variants.map((variant) => ({ ...variant })) }));

    if (actionType === 'decrease') {
      for (const item of order.lineItems || []) {
        const product = nextProducts.find((entry) => String(entry.id) === String(item.productId));
        if (!product) continue;
        const variant = product.variants.find((entry) => String(entry.id) === String(item.variantId)) || product.variants[0];
        if (!variant) continue;
        const quantity = Math.max(1, Math.trunc(toNumber(item.quantity, 1)));
        if (toNumber(variant.stock, 0) < quantity) {
          throw new AppError(
            409,
            'INSUFFICIENT_STOCK',
            `Insufficient stock for ${product.name} (${variant.size}/${variant.color}/${variant.material})`
          );
        }
      }
    }

    for (const item of order.lineItems || []) {
      const product = nextProducts.find((entry) => String(entry.id) === String(item.productId));
      if (!product) continue;
      const variant = product.variants.find((entry) => String(entry.id) === String(item.variantId)) || product.variants[0];
      if (!variant) continue;
      const quantity = Math.max(1, Math.trunc(toNumber(item.quantity, 1)));
      if (actionType === 'decrease') {
        variant.stock = toNumber(variant.stock, 0) - quantity;
        await recordStockMovement(context, {
          type: 'order_confirmed',
          productId: product.id,
          variantId: variant.id,
          quantity: -quantity,
          reason: `Order ${order.id} confirmed`,
          orderId: order.id,
        });
      }
      if (actionType === 'restore') {
        variant.stock = toNumber(variant.stock, 0) + quantity;
        await recordStockMovement(context, {
          type: order.status === 'Returned' ? 'return_received' : 'order_cancelled',
          productId: product.id,
          variantId: variant.id,
          quantity,
          reason: `Order ${order.id} ${order.status.toLowerCase()}`,
          orderId: order.id,
        });
      }
      product.stock = product.variants.reduce((sum, entry) => sum + toNumber(entry.stock, 0), 0);
      await notifyLowStock(product);
    }

    await persistProducts(nextProducts);
  }

  async function listOrders(filters = {}) {
    const products = await listProducts();
    let rows = (await ordersRepo.list()).map((order) => normalizeOrder(order, products));
    const search = String(filters.search || '').toLowerCase();
    if (search) {
      rows = rows.filter((order) =>
        [order.id, order.customer, order.email, order.phone, order.city, order.source].some((value) =>
          String(value || '').toLowerCase().includes(search)
        )
      );
    }
    if (filters.status) rows = rows.filter((order) => order.status === filters.status);
    if (filters.paymentStatus) rows = rows.filter((order) => order.paymentStatus === filters.paymentStatus);
    if (filters.deliveryStatus) rows = rows.filter((order) => order.deliveryStatus === filters.deliveryStatus);
    return rows.sort((left, right) => String(right.date).localeCompare(String(left.date)));
  }

  async function getOrder(id) {
    const products = await listProducts();
    const order = await ordersRepo.getById(id);
    return order ? normalizeOrder(order, products) : null;
  }

  async function createOrder(context, payload) {
    const products = await listProducts();
    const lineItems = Array.isArray(payload.lineItems) ? payload.lineItems.map((item) => normalizeLineItem(item, products)) : [];
    const status = normalizeOrderStatus(payload.status || 'New');
    const order = normalizeOrder(
      {
        ...payload,
        id: payload.id || createId('ord'),
        status,
        paymentStatus: normalizePaymentStatus(payload.paymentStatus || payload.payment),
        deliveryStatus: normalizeDeliveryStatus(payload.deliveryStatus || payload.delivery),
        lineItems,
        amount: orderTotal(lineItems, payload.deliveryFee),
        total: orderTotal(lineItems, payload.deliveryFee),
        date: payload.date || now(),
        timeline: [{ id: createId('evt'), type: 'created', label: 'Order created', timestamp: now(), userId: context.user?.id || '' }],
      },
      products
    );
    const created = await ordersRepo.create(order);
    if (status === 'Confirmed') {
      await applyOrderStock(context, created, 'decrease');
      await ordersRepo.update(created.id, { stockAction: 'decreased' });
      created.stockAction = 'decreased';
    }
    await notificationService.notify({
      type: 'info',
      priority: 'medium',
      title: 'New order',
      message: `${created.id} created for ${created.customer}`,
      link: `/admin/orders/${encodeURIComponent(created.id)}`,
      entityType: 'order',
      entityId: created.id,
    });
    await auditLogService.record(context, 'orders.create', 'order', created.id, created);
    return created;
  }

  async function updateOrder(context, id, patch) {
    const current = await getOrder(id);
    if (!current) throw new AppError(404, 'NOT_FOUND', 'Order not found');
    const nextStatus = patch.status ? normalizeOrderStatus(patch.status) : current.status;
    const nextPayment = patch.paymentStatus || patch.payment ? normalizePaymentStatus(patch.paymentStatus || patch.payment) : current.paymentStatus;
    const nextDelivery = patch.deliveryStatus || patch.delivery ? normalizeDeliveryStatus(patch.deliveryStatus || patch.delivery) : current.deliveryStatus;
    const products = await listProducts();
    const nextLineItems = patch.lineItems ? patch.lineItems.map((item) => normalizeLineItem(item, products)) : current.lineItems;
    const next = normalizeOrder({
      ...current,
      ...patch,
      status: nextStatus,
      paymentStatus: nextPayment,
      payment: nextPayment,
      deliveryStatus: nextDelivery,
      delivery: legacyDeliveryStatus(nextDelivery),
      lineItems: nextLineItems,
      total: patch.total ?? patch.amount ?? orderTotal(nextLineItems, patch.deliveryFee ?? current.deliveryFee),
      amount: patch.amount ?? patch.total ?? orderTotal(nextLineItems, patch.deliveryFee ?? current.deliveryFee),
      timeline: [
        ...(current.timeline || []),
        ...(nextStatus !== current.status
          ? [{ id: createId('evt'), type: 'status', label: `Status changed to ${nextStatus}`, timestamp: now(), userId: context.user?.id || '' }]
          : []),
      ],
    });

    if (nextStatus === 'Confirmed' && current.stockAction !== 'decreased') {
      await applyOrderStock(context, next, 'decrease');
      next.stockAction = 'decreased';
    }
    if ((nextStatus === 'Cancelled' || nextStatus === 'Returned') && current.stockAction === 'decreased') {
      await applyOrderStock(context, next, 'restore');
      next.stockAction = 'restored';
      await notificationService.notify({
        type: 'info',
        priority: 'low',
        title: 'Stock restored',
        message: `${next.id} stock restored after ${nextStatus}`,
        link: `/admin/orders/${encodeURIComponent(next.id)}`,
        entityType: 'order',
        entityId: next.id,
      });
    }

    const updated = await ordersRepo.update(id, next);
    await auditLogService.record(context, 'orders.update', 'order', id, { patch, previousStatus: current.status, nextStatus });
    return updated;
  }

  async function deleteOrder(context, id) {
    const removed = await ordersRepo.remove(id);
    await auditLogService.record(context, 'orders.delete', 'order', id, removed);
    return removed;
  }

  async function createProduct(context, payload) {
    const created = await productsRepo.create(normalizeProduct({ ...payload, id: payload.id || createId('prd'), updated: now().slice(0, 10) }));
    await auditLogService.record(context, 'products.create', 'product', created.id, created);
    await notifyLowStock(created);
    return normalizeProduct(created);
  }

  async function updateProduct(context, id, patch) {
    const current = await productsRepo.getById(id);
    if (!current) throw new AppError(404, 'NOT_FOUND', 'Product not found');
    const updated = await productsRepo.update(id, normalizeProduct({ ...current, ...patch, updated: now().slice(0, 10) }));
    await auditLogService.record(context, 'products.update', 'product', id, patch);
    await notifyLowStock(updated);
    return normalizeProduct(updated);
  }

  async function deleteProduct(context, id) {
    const deleted = await productsRepo.remove(id);
    await auditLogService.record(context, 'products.delete', 'product', id, deleted);
    return deleted;
  }

  async function adjustStock(context, productId, payload) {
    const products = await listProducts();
    const product = products.find((entry) => String(entry.id) === String(productId));
    if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found');
    const variant = product.variants.find((entry) => String(entry.id) === String(payload.variantId)) || product.variants[0];
    const rawQuantity = Math.trunc(toNumber(payload.quantity, 0));
    if (!rawQuantity) throw new AppError(400, 'VALIDATION_ERROR', 'quantity is required');
    const type = STOCK_MOVEMENT_TYPES.includes(payload.type) ? payload.type : 'manual_adjustment';
    const absoluteQuantity = Math.abs(rawQuantity);
    const delta =
      type === 'stock_added' || type === 'return_received'
        ? absoluteQuantity
        : type === 'stock_removed' || type === 'order_reserved' || type === 'order_confirmed'
          ? -absoluteQuantity
          : rawQuantity;
    const nextStock = toNumber(variant.stock, 0) + delta;
    if (nextStock < 0) {
      throw new AppError(409, 'NEGATIVE_STOCK_PREVENTED', 'Stock cannot go below zero');
    }
    variant.stock = nextStock;
    product.stock = product.variants.reduce((sum, entry) => sum + toNumber(entry.stock, 0), 0);
    await persistProducts(products);
    const movement = await recordStockMovement(context, {
      type,
      productId,
      variantId: variant.id,
      quantity: delta,
      reason: payload.reason || 'Manual adjustment',
    });
    await notifyLowStock(product);
    return { product: normalizeProduct(product), movement };
  }

  async function listStockAlerts() {
    const products = await listProducts();
    return products
      .flatMap((product) =>
        product.variants.map((variant) => ({
          id: `${product.id}:${variant.id}`,
          productId: product.id,
          productName: product.name,
          variantId: variant.id,
          size: variant.size,
          color: variant.color,
          material: variant.material,
          stock: variant.stock,
          threshold: variant.lowStockThreshold,
          type: variant.stock <= 0 ? 'out_of_stock' : variant.stock <= variant.lowStockThreshold ? 'low_stock' : 'ok',
        }))
      )
      .filter((alert) => alert.type !== 'ok');
  }

  async function listCustomers() {
    const orders = await listOrders();
    return (await customersRepo.list()).map(normalizeCustomer).map((customer) => ({
      ...customer,
      ...computeCustomerStats(customer, orders),
    }));
  }

  async function getCustomer(id) {
    const row = await customersRepo.getById(id);
    if (!row) return null;
    const customer = normalizeCustomer(row);
    return { ...customer, ...computeCustomerStats(customer, await listOrders()) };
  }

  async function createCustomer(context, payload) {
    const created = await customersRepo.create(normalizeCustomer({ ...payload, id: payload.id || createId('cus') }));
    await auditLogService.record(context, 'customers.create', 'customer', created.id, created);
    return created;
  }

  async function updateCustomer(context, id, patch) {
    const current = await customersRepo.getById(id);
    if (!current) throw new AppError(404, 'NOT_FOUND', 'Customer not found');
    const updated = await customersRepo.update(id, normalizeCustomer({ ...current, ...patch }));
    await auditLogService.record(context, 'customers.update', 'customer', id, patch);
    return updated;
  }

  async function deleteCustomer(context, id) {
    const deleted = await customersRepo.remove(id);
    await auditLogService.record(context, 'customers.delete', 'customer', id, deleted);
    return deleted;
  }

  async function addCustomerNote(context, id, text) {
    const customer = normalizeCustomer(await customersRepo.getById(id));
    if (!customer) throw new AppError(404, 'NOT_FOUND', 'Customer not found');
    const note = { id: createId('note'), text: String(text || '').trim(), createdAt: now(), createdBy: context.user?.id || '' };
    if (!note.text) throw new AppError(400, 'VALIDATION_ERROR', 'note text is required');
    const updated = await customersRepo.update(id, { notes: [...customer.notes, note] });
    await auditLogService.record(context, 'customers.note', 'customer', id, note);
    return updated;
  }

  async function addCustomerReminder(context, id, payload) {
    const customer = normalizeCustomer(await customersRepo.getById(id));
    if (!customer) throw new AppError(404, 'NOT_FOUND', 'Customer not found');
    const reminder = {
      id: createId('rem'),
      title: String(payload.title || 'Follow up'),
      dueAt: payload.dueAt || now(),
      status: String(payload.status || 'Open'),
      createdAt: now(),
    };
    const updated = await customersRepo.update(id, { reminders: [...customer.reminders, reminder] });
    await auditLogService.record(context, 'customers.reminder', 'customer', id, reminder);
    await notificationService.notify({
      type: 'info',
      priority: 'medium',
      title: 'Customer needs follow-up',
      message: `${customer.name}: ${reminder.title}`,
      link: '/admin/customers',
      entityType: 'customer',
      entityId: id,
      dedupeKey: `customer_follow_up:${id}:${reminder.id}`,
    });
    return updated;
  }

  async function listDeliveries(filters = {}) {
    let rows = (await deliveriesRepo.list()).map(normalizeDelivery);
    if (filters.status) rows = rows.filter((delivery) => delivery.status === filters.status);
    if (filters.city) rows = rows.filter((delivery) => delivery.city === filters.city);
    return rows.sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
  }

  async function getDelivery(id) {
    const row = await deliveriesRepo.getById(id);
    return row ? normalizeDelivery(row) : null;
  }

  async function createDelivery(context, payload) {
    const created = await deliveriesRepo.create(normalizeDelivery({ ...payload, id: payload.id || createId('del') }));
    if (created.orderId) {
      await updateOrder(context, created.orderId, {
        deliveryId: created.id,
        deliveryStatus: created.status,
        deliveryFee: created.deliveryFee,
        deliveryType: created.deliveryType,
        deliveryCompanyName: created.company,
        driverName: created.driverName,
        driverPhone: created.driverPhone,
        trackingNumber: created.trackingNumber,
      });
    }
    await auditLogService.record(context, 'delivery.create', 'delivery', created.id, created);
    return created;
  }

  async function createManualOrder(context, payload = {}) {
    const customerInput = payload.customer && typeof payload.customer === 'object' ? payload.customer : payload;
    const itemsInput = Array.isArray(payload.items)
      ? payload.items
      : Array.isArray(payload.lineItems)
        ? payload.lineItems
        : [];

    const customerName = String(customerInput.name || customerInput.customerName || '').trim();
    const phone = String(customerInput.phone || '').trim();
    const address = String(customerInput.address || '').trim();
    const city = String(customerInput.city || '').trim();
    const country = String(customerInput.country || 'Tunisia').trim() || 'Tunisia';
    if (!customerName) throw new AppError(400, 'VALIDATION_ERROR', 'customer name is required');
    if (!phone) throw new AppError(400, 'VALIDATION_ERROR', 'phone number is required');
    if (!address) throw new AppError(400, 'VALIDATION_ERROR', 'address is required');
    if (!itemsInput.length) throw new AppError(400, 'VALIDATION_ERROR', 'At least one product is required');

    const products = await listProducts();
    const normalizedLineItems = [];
    for (const rawItem of itemsInput) {
      const productId = String(rawItem.productId || '').trim();
      const product = products.find((entry) => String(entry.id) === productId);
      if (!product) {
        throw new AppError(404, 'NOT_FOUND', `Product not found: ${productId || 'unknown'}`);
      }
      const requestedVariantId = String(rawItem.variantId || '').trim();
      const variant =
        product.variants.find((entry) => String(entry.id) === requestedVariantId) ||
        product.variants.find(
          (entry) =>
            String(entry.size || '').toLowerCase() === String(rawItem.size || '').trim().toLowerCase() &&
            String(entry.color || '').toLowerCase() === String(rawItem.color || '').trim().toLowerCase() &&
            String(entry.material || '').toLowerCase() === String(rawItem.material || '').trim().toLowerCase()
        ) ||
        product.variants[0];
      const quantity = Math.max(1, Math.trunc(toNumber(rawItem.quantity, 1)));
      const unitPrice = Math.max(0, toNumber(rawItem.unitPrice ?? product.price, product.price));
      normalizedLineItems.push(
        normalizeLineItem(
          {
            id: rawItem.id,
            productId: product.id,
            variantId: variant?.id || requestedVariantId,
            name: product.name,
            sku: variant?.sku || product.sku,
            size: variant?.size,
            color: variant?.color,
            material: variant?.material,
            quantity,
            unitPrice,
            costPrice: product.costPrice,
          },
          products
        )
      );
    }

    for (const item of normalizedLineItems) {
      const product = products.find((entry) => String(entry.id) === String(item.productId));
      if (!product) continue;
      const variant = product.variants.find((entry) => String(entry.id) === String(item.variantId)) || product.variants[0];
      if (!variant) continue;
      if (toNumber(variant.stock, 0) < item.quantity) {
        throw new AppError(
          409,
          'INSUFFICIENT_STOCK',
          `Insufficient stock for ${product.name} (${variant.size}/${variant.color}/${variant.material})`
        );
      }
    }

    const orderStatus = normalizeManualOrderStatus(payload.status);
    const paymentMethod = normalizeOrderPaymentMethod(payload.paymentMethod || payload.payment);
    const paymentStatus = normalizePaymentStatus(payload.paymentStatus || (paymentMethod === 'Cash on delivery' ? 'Cash on Delivery' : 'Unpaid'));
    const deliveryStatus = normalizeManualDeliveryStatus(payload.deliveryStatus);
    const deliveryType = String(payload.deliveryType || '').trim();
    const deliveryCompanyName = String(payload.deliveryCompanyName || payload.deliveryCompany || '').trim();
    const driverName = String(payload.driverName || '').trim();
    const driverPhone = String(payload.driverPhone || '').trim();
    const trackingNumber = String(payload.trackingNumber || '').trim();
    const discount = Math.max(0, toNumber(payload.discount, 0));
    const customerSource = String(customerInput.source || payload.customerSource || payload.source || 'Manual').trim() || 'Manual';
    const customerNote = String(customerInput.note || payload.customerNote || '').trim();
    const internalNote = String(payload.internalNote || '').trim();
    const deliveryFee = Math.max(0, toNumber(payload.deliveryFee, 0));
    const totals = buildManualOrderTotals(normalizedLineItems, discount, deliveryFee);
    const source = customerSource;

    const existingCustomers = (await customersRepo.list()).map(normalizeCustomer);
    const matchedCustomer = findMatchingCustomer(existingCustomers, { phone, email: customerInput.email || payload.email });
    const customerRecord = matchedCustomer
      ? await customersRepo.update(
          matchedCustomer.id,
          normalizeCustomer({
            ...matchedCustomer,
            name: customerName,
            phone,
            email: String(customerInput.email || payload.email || '').trim(),
            address,
            city,
            country,
            source: customerSource,
            notes: [
              ...matchedCustomer.notes,
              ...(customerNote
                ? [
                    {
                      id: createId('note'),
                      text: customerNote,
                      createdAt: now(),
                      createdBy: context.user?.id || '',
                    },
                  ]
                : []),
            ],
          })
        )
      : await customersRepo.create(
          normalizeCustomer({
            id: createId('cus'),
            name: customerName,
            email: String(customerInput.email || payload.email || '').trim(),
            phone,
            address,
            city,
            country,
            source: customerSource,
            notes: customerNote
              ? [
                  {
                    id: createId('note'),
                    text: customerNote,
                    createdAt: now(),
                    createdBy: context.user?.id || '',
                  },
                ]
              : [],
          })
        );

    const order = normalizeOrder(
      {
        id: payload.id || createId('ord'),
        customerId: customerRecord.id,
        customer: customerName,
        customerSource,
        customerNote,
        email: String(customerInput.email || payload.email || '').trim(),
        phone,
        address,
        city,
        country,
        source,
        status: orderStatus,
        paymentMethod,
        paymentStatus,
        payment: paymentStatus,
        deliveryType,
        deliveryCompanyName,
        driverName,
        driverPhone,
        trackingNumber,
        deliveryStatus,
        delivery: legacyDeliveryStatus(deliveryStatus),
        deliveryFee,
        discount,
        amount: totals.total,
        total: totals.total,
        lineItems: normalizedLineItems,
        internalNote,
        internalNotes: internalNote
          ? [
              {
                id: createId('note'),
                text: internalNote,
                createdAt: now(),
                createdBy: context.user?.id || '',
              },
            ]
          : [],
        timeline: [
          {
            id: createId('evt'),
            type: 'created',
            label: 'Manual order created',
            timestamp: now(),
            userId: context.user?.id || '',
          },
        ],
        manualOrder: true,
      },
      products
    );

    const created = await ordersRepo.create(order);

    if (orderStatus === 'Confirmed') {
      try {
        await applyOrderStock(context, created, 'decrease');
        await ordersRepo.update(created.id, { stockAction: 'decreased' });
        created.stockAction = 'decreased';
      } catch (error) {
        await ordersRepo.remove(created.id);
        throw error;
      }
    }

    let delivery = null;
    const hasDeliveryDetails = deliveryType || deliveryCompanyName || driverName || driverPhone || trackingNumber;
    if (hasDeliveryDetails) {
      delivery = await deliveriesRepo.create(
        normalizeDelivery({
          id: payload.deliveryId || createId('del'),
          orderId: created.id,
          customerId: customerRecord.id,
          deliveryType: deliveryType || 'home delivery',
          company: deliveryCompanyName,
          driverName,
          driverPhone,
          trackingNumber,
          deliveryFee,
          address,
          city,
          status: deliveryStatus,
          timeline: [
            {
              id: createId('evt'),
              status: deliveryStatus,
              timestamp: now(),
              userId: context.user?.id || '',
            },
          ],
        })
      );
      created.deliveryId = delivery.id;
      created.deliveryStatus = delivery.status;
      created.delivery = legacyDeliveryStatus(delivery.status);
      created.deliveryType = delivery.deliveryType;
      created.deliveryCompanyName = delivery.company;
      created.driverName = delivery.driverName;
      created.driverPhone = delivery.driverPhone;
      created.trackingNumber = delivery.trackingNumber;
      await ordersRepo.update(created.id, {
        deliveryId: delivery.id,
        deliveryStatus: delivery.status,
        delivery: legacyDeliveryStatus(delivery.status),
        deliveryType: delivery.deliveryType,
        deliveryCompanyName: delivery.company,
        driverName: delivery.driverName,
        driverPhone: delivery.driverPhone,
        trackingNumber: delivery.trackingNumber,
      });
    }

    const notified = await notificationService.notify({
      type: 'info',
      priority: 'medium',
      title: 'New manual order created',
      message: `${created.id} created for ${created.customer}`,
      link: `/admin/orders/${encodeURIComponent(created.id)}`,
      entityType: 'order',
      entityId: created.id,
    });
    await auditLogService.record(context, 'orders.manual_create', 'order', created.id, {
      order: created,
      customer: customerRecord,
      delivery,
      notificationId: notified?.id || null,
    });

    return normalizeOrder(created, products);
  }

  async function generateDeliveryNote(context, orderId) {
    const order = await getOrder(orderId);
    if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');
    const nextNumberSuffix = String(order.id).replace(/\D/g, '') || String(Date.now()).slice(-6);
    const created = await deliveryNotesRepo.create({
      id: createId('dn'),
      number: `BL-${nextNumberSuffix}`,
      orderId: order.id,
      deliveryId: order.deliveryId || '',
      customerName: order.customer,
      customerId: order.customerId,
      status: order.deliveryStatus,
      lineItems: order.lineItems,
      deliveryType: order.deliveryType,
      createdAt: now(),
      updatedAt: now(),
    });
    await auditLogService.record(context, 'delivery_notes.generate', 'delivery_note', created.id, {
      orderId: order.id,
    });
    return created;
  }

  async function updateDelivery(context, id, patch) {
    const row = await deliveriesRepo.getById(id);
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Delivery not found');
    const current = normalizeDelivery(row);
    const status = patch.status ? normalizeDeliveryStatus(patch.status) : current.status;
    const updated = await deliveriesRepo.update(id, normalizeDelivery({
      ...current,
      ...patch,
      status,
      updatedAt: now(),
      timeline: [
        ...(current.timeline || []),
        ...(status !== current.status ? [{ id: createId('evt'), status, timestamp: now(), userId: context.user?.id || '' }] : []),
      ],
    }));
    if (updated.orderId) {
      await updateOrder(context, updated.orderId, { deliveryStatus: updated.status, delivery: legacyDeliveryStatus(updated.status) });
    }
    if (updated.status === 'Failed') {
      await notificationService.notify({
        type: 'warning',
        priority: 'high',
        title: 'Delivery failed',
        message: `${updated.trackingNumber || updated.orderId || updated.id} failed${updated.failedReason ? `: ${updated.failedReason}` : ''}`,
        link: '/admin/delivery',
        entityType: 'delivery',
        entityId: updated.id,
        dedupeKey: `delivery_failed:${updated.id}:${updated.updatedAt}`,
      });
    }
    await auditLogService.record(context, 'delivery.update', 'delivery', id, patch);
    return updated;
  }

  async function deleteDelivery(context, id) {
    const current = await getDelivery(id);
    if (!current) throw new AppError(404, 'NOT_FOUND', 'Delivery not found');
    const deleted = await deliveriesRepo.remove(id);
    await auditLogService.record(context, 'delivery.delete', 'delivery', id, {
      orderId: current.orderId,
      trackingNumber: current.trackingNumber,
    });
    return normalizeDelivery(deleted);
  }

  async function deliveryReport(date = now().slice(0, 10)) {
    const rows = await listDeliveries();
    const dayRows = rows.filter((delivery) => String(delivery.updatedAt || delivery.createdAt).startsWith(date));
    const byStatus = DELIVERY_STATUSES.reduce((acc, status) => {
      acc[status] = dayRows.filter((delivery) => delivery.status === status).length;
      return acc;
    }, {});
    return { date, total: dayRows.length, byStatus, deliveries: dayRows };
  }

  async function generateInvoice(context, orderId) {
    const order = await getOrder(orderId);
    if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');
    const subtotal = order.lineItems.reduce((sum, item) => sum + item.total, 0);
    const costTotal = order.lineItems.reduce((sum, item) => sum + item.costPrice * item.quantity, 0);
    const discountTotal = Math.max(0, toNumber(order.discount ?? order.discountTotal, 0));
    const invoice = normalizeInvoice({
      id: createId('inv'),
      number: `INV-${String(Date.now()).slice(-8)}`,
      orderId: order.id,
      customerId: order.customerId,
      customerName: order.customer,
      lineItems: order.lineItems,
      subtotal,
      deliveryFee: order.deliveryFee,
      discountTotal,
      total: Math.max(0, subtotal - discountTotal + order.deliveryFee),
      costTotal,
      grossMargin: subtotal - costTotal,
      paymentStatus: order.paymentStatus,
      status: 'Issued',
    });
    const created = await invoicesRepo.create(invoice);
    await auditLogService.record(context, 'invoices.generate', 'invoice', created.id, { orderId });
    return created;
  }

  async function accountingSummary() {
    const orders = await listOrders();
    const invoices = (await invoicesRepo.list()).map(normalizeInvoice);
    const expenses = await expensesRepo.list();
    const revenue = orders
      .filter((order) => !['Cancelled', 'Returned'].includes(order.status))
      .reduce((sum, order) => sum + toNumber(order.total ?? order.amount, 0), 0);
    const cost = orders.reduce(
      (sum, order) => sum + (order.lineItems || []).reduce((itemSum, item) => itemSum + toNumber(item.costPrice, 0) * toNumber(item.quantity, 0), 0),
      0
    );
    const expenseTotal = expenses.reduce((sum, expense) => sum + toNumber(expense.amount, 0), 0);
    return {
      revenue: Math.round(revenue * 100) / 100,
      cost: Math.round(cost * 100) / 100,
      expenses: Math.round(expenseTotal * 100) / 100,
      grossMargin: Math.round((revenue - cost) * 100) / 100,
      profit: Math.round((revenue - cost - expenseTotal) * 100) / 100,
      invoicesCount: invoices.length,
      paymentTracking: PAYMENT_STATUSES.reduce((acc, status) => {
        acc[status] = invoices.filter((invoice) => invoice.paymentStatus === status).length;
        return acc;
      }, {}),
    };
  }

  async function exportAccountingCsv(context) {
    const invoices = (await invoicesRepo.list()).map(normalizeInvoice);
    const header = 'number,orderId,customer,total,paymentStatus,createdAt';
    const rows = invoices.map((invoice) =>
      [invoice.number, invoice.orderId, invoice.customerName || '', invoice.total, invoice.paymentStatus, invoice.createdAt]
        .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(',')
    );
    await auditLogService.record(context, 'accounting.export_csv', 'accounting', 'csv', { rows: rows.length });
    return [header, ...rows].join('\n');
  }

  async function listMarketingCampaigns() {
    return (await marketingCampaignsRepo.list()).map(normalizeMarketingCampaign);
  }

  async function getMarketingCampaign(id) {
    const row = await marketingCampaignsRepo.getById(id);
    return row ? normalizeMarketingCampaign(row) : null;
  }

  async function createMarketingCampaign(context, payload) {
    const created = await marketingCampaignsRepo.create(normalizeMarketingCampaign({ ...payload, id: payload.id || createId('mkt') }));
    await auditLogService.record(context, 'marketing.create', 'marketing_campaign', created.id, created);
    if (created.status === 'Scheduled') {
      await notificationService.notify({
        type: 'info',
        priority: 'medium',
        title: 'Campaign scheduled',
        message: `${created.name} scheduled${created.scheduledAt ? ` for ${created.scheduledAt}` : ''}.`,
        link: '/admin/email-sms',
        entityType: 'marketing_campaign',
        entityId: created.id,
      });
    }
    if (created.status === 'Sent') {
      await notificationService.notify({
        type: 'success',
        priority: 'medium',
        title: 'Campaign sent',
        message: `${created.name} was sent.`,
        link: '/admin/email-sms',
        entityType: 'marketing_campaign',
        entityId: created.id,
      });
    }
    return created;
  }

  async function updateMarketingCampaign(context, id, patch) {
    const row = await marketingCampaignsRepo.getById(id);
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Marketing campaign not found');
    const current = normalizeMarketingCampaign(row);
    const next = normalizeMarketingCampaign({
      ...current,
      ...patch,
      sentAt: patch.status === 'Sent' && !current.sentAt ? now() : current.sentAt,
    });
    const updated = await marketingCampaignsRepo.update(id, next);
    if (patch.status === 'Scheduled') {
      await notificationService.notify({
        type: 'info',
        priority: 'medium',
        title: 'Campaign scheduled',
        message: `${next.name} scheduled${next.scheduledAt ? ` for ${next.scheduledAt}` : ''}.`,
        link: '/admin/email-sms',
        entityType: 'marketing_campaign',
        entityId: id,
        dedupeKey: `campaign_scheduled:${id}:${next.scheduledAt || next.updatedAt || now()}`,
      });
    }
    if (patch.status === 'Sent') {
      await notificationService.notify({
        type: 'success',
        priority: 'medium',
        title: 'Campaign sent',
        message: `${next.name} was sent.`,
        link: '/admin/email-sms',
        entityType: 'marketing_campaign',
        entityId: id,
        dedupeKey: `campaign_sent:${id}:${next.sentAt || now()}`,
      });
    }
    await auditLogService.record(context, 'marketing.update', 'marketing_campaign', id, patch);
    return updated;
  }

  async function deleteMarketingCampaign(context, id) {
    const current = await getMarketingCampaign(id);
    if (!current) throw new AppError(404, 'NOT_FOUND', 'Marketing campaign not found');
    const deleted = await marketingCampaignsRepo.remove(id);
    await auditLogService.record(context, 'marketing.delete', 'marketing_campaign', id, {
      name: current.name,
      status: current.status,
    });
    return normalizeMarketingCampaign(deleted);
  }

  function generateCopy(payload, type) {
    const product = String(payload.product || payload.topic || 'your best-selling product');
    const audience = String(payload.audience || payload.segment || 'online shoppers');
    if (type === 'email') {
      return {
        subject: `A fresh offer for ${audience}`,
        body: `Hi, we prepared a simple offer around ${product}. Clear benefits, fast delivery, and limited stock. Reply to reserve yours today.`,
      };
    }
    return {
      headline: `Sell more ${product}`,
      primaryText: `Reach ${audience} with a direct offer, strong social proof, and a simple order path.`,
      ideas: ['Retarget recent visitors', 'Highlight cash on delivery', 'Show best-selling variants'],
    };
  }

  async function maybeNotifyAdHealth(campaign) {
    const normalized = normalizeAdCampaign(campaign);
    if (normalized.budget >= 1000) {
      await notificationService.notify({
        type: 'warning',
        priority: 'high',
        title: 'High ad spend alert',
        message: `${normalized.name} budget is ${normalized.budget} TND.`,
        link: '/admin/ads',
        entityType: 'ad_campaign',
        entityId: normalized.id,
        dedupeKey: `high_ad_spend:${normalized.id}:${normalized.budget}`,
      });
    }
    if (normalized.roas > 0 && normalized.roas < 1.5) {
      await notificationService.notify({
        type: 'warning',
        priority: 'high',
        title: 'Low ROAS alert',
        message: `${normalized.name} ROAS is ${normalized.roas}.`,
        link: '/admin/ads',
        entityType: 'ad_campaign',
        entityId: normalized.id,
        dedupeKey: `low_roas:${normalized.id}:${normalized.roas}`,
      });
    }
  }

  async function listAdCampaigns() {
    return (await adCampaignsRepo.list()).map(normalizeAdCampaign);
  }

  async function getAdCampaign(id) {
    const row = await adCampaignsRepo.getById(id);
    return row ? normalizeAdCampaign(row) : null;
  }

  async function createAdCampaign(context, payload) {
    const created = await adCampaignsRepo.create(normalizeAdCampaign({ ...payload, id: payload.id || createId('ad') }));
    await auditLogService.record(context, 'ads.create', 'ad_campaign', created.id, created);
    await maybeNotifyAdHealth(created);
    return created;
  }

  async function updateAdCampaign(context, id, patch) {
    const row = await adCampaignsRepo.getById(id);
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Ad campaign not found');
    const current = normalizeAdCampaign(row);
    const updated = await adCampaignsRepo.update(id, normalizeAdCampaign({ ...current, ...patch }));
    await maybeNotifyAdHealth(updated);
    await auditLogService.record(context, 'ads.update', 'ad_campaign', id, patch);
    return updated;
  }

  async function deleteAdCampaign(context, id) {
    const current = await getAdCampaign(id);
    if (!current) throw new AppError(404, 'NOT_FOUND', 'Ad campaign not found');
    const deleted = await adCampaignsRepo.remove(id);
    await auditLogService.record(context, 'ads.delete', 'ad_campaign', id, {
      name: current.name,
      platform: current.platform,
    });
    return normalizeAdCampaign(deleted);
  }

  async function analyticsOverview() {
    const [orders, products, customers, adCampaigns] = await Promise.all([
      listOrders(),
      listProducts(),
      listCustomers(),
      listAdCampaigns(),
    ]);
    const validOrders = orders.filter((order) => !['Cancelled', 'Returned'].includes(order.status));
    const revenue = validOrders.reduce((sum, order) => sum + toNumber(order.total ?? order.amount, 0), 0);
    const byDayMap = new Map();
    const byCityMap = new Map();
    const byStatus = ORDER_STATUSES.reduce((acc, status) => ({ ...acc, [status]: 0 }), {});
    const productMap = new Map();
    for (const order of orders) {
      byStatus[order.status] = (byStatus[order.status] || 0) + 1;
      const day = String(order.date || '').slice(0, 10) || 'unknown';
      byDayMap.set(day, (byDayMap.get(day) || 0) + toNumber(order.total ?? order.amount, 0));
      if (order.city) byCityMap.set(order.city, (byCityMap.get(order.city) || 0) + toNumber(order.total ?? order.amount, 0));
      for (const item of order.lineItems || []) {
        const current = productMap.get(item.productId) || { productId: item.productId, name: item.name, quantity: 0, revenue: 0 };
        current.quantity += toNumber(item.quantity, 0);
        current.revenue += toNumber(item.total, 0);
        productMap.set(item.productId, current);
      }
    }
    const revenueByDay = [...byDayMap.entries()].sort().map(([date, value]) => ({ date, revenue: Math.round(value * 100) / 100 }));
    return {
      kpis: {
        revenue: Math.round(revenue * 100) / 100,
        orders: orders.length,
        customers: customers.length,
        averageOrderValue: validOrders.length ? Math.round((revenue / validOrders.length) * 100) / 100 : 0,
        conversionRate: null,
      },
      revenueByDay,
      ordersByStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
      salesByCity: [...byCityMap.entries()].map(([city, value]) => ({ city, revenue: Math.round(value * 100) / 100 })),
      bestSellingProducts: [...productMap.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 10),
      customerAcquisitionSource: adCampaigns.map((campaign) => ({ source: campaign.platform, leads: campaign.leads, orders: campaign.orders })),
      ga4: { connected: false, placeholder: true },
      productCount: products.length,
    };
  }

  async function listSalesChannels() {
    const rows = (await salesChannelsRepo.list()).map(normalizeSalesChannel);
    if (!rows.some((channel) => channel.provider === 'manual')) {
      rows.unshift(normalizeSalesChannel({ id: 'manual', provider: 'manual', name: 'Manual sales channel', status: 'connected' }));
    }
    return rows;
  }

  async function getSalesChannel(id) {
    return (await listSalesChannels()).find((entry) => String(entry.id) === String(id)) || null;
  }

  async function createSalesChannel(context, payload) {
    const created = await salesChannelsRepo.create(normalizeSalesChannel({ ...payload, id: payload.id || createId('chn') }));
    await auditLogService.record(context, 'integrations.create', 'sales_channel', created.id, created);
    return created;
  }

  async function updateSalesChannel(context, id, patch) {
    const row = await salesChannelsRepo.getById(id);
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Sales channel not found');
    const current = normalizeSalesChannel(row);
    const updated = await salesChannelsRepo.update(id, normalizeSalesChannel({ ...current, ...patch }));
    await auditLogService.record(context, 'integrations.update', 'sales_channel', id, patch);
    return updated;
  }

  async function deleteSalesChannel(context, id) {
    const current = await getSalesChannel(id);
    if (!current) throw new AppError(404, 'NOT_FOUND', 'Sales channel not found');
    if (current.provider === 'manual') {
      throw new AppError(409, 'CANNOT_DELETE_MANUAL_CHANNEL', 'Manual sales channel cannot be deleted');
    }
    const deleted = await salesChannelsRepo.remove(id);
    await auditLogService.record(context, 'integrations.delete', 'sales_channel', id, {
      provider: current.provider,
      name: current.name,
    });
    return normalizeSalesChannel(deleted);
  }

  async function runSync(context, channelId, type) {
    const channel = (await listSalesChannels()).find((entry) => String(entry.id) === String(channelId));
    if (!channel) throw new AppError(404, 'NOT_FOUND', 'Sales channel not found');
    if (!channel.enabled && channel.provider !== 'manual') {
      await notificationService.notify({
        type: 'warning',
        priority: 'high',
        title: 'Sync failed',
        message: `${channel.name} is disconnected. Connect it before syncing ${type}.`,
        link: '/admin/integrations-settings',
        entityType: 'sales_channel',
        entityId: channel.id,
        dedupeKey: `sync_failed:${channel.id}:${type}`,
      });
      throw new AppError(409, 'SYNC_FAILED', 'Sales channel is disconnected');
    }
    const imported = type === 'orders' && channel.provider !== 'manual' ? 1 : 0;
    const job = await syncJobsRepo.create({
      id: createId('sync'),
      channelId,
      provider: channel.provider,
      type: type === 'orders' ? 'orders' : 'products',
      status: 'completed',
      startedAt: now(),
      completedAt: now(),
      result: {
        imported,
        updated: 0,
        skipped: 0,
        mode: channel.provider === 'manual' ? 'manual-placeholder' : 'mock-placeholder',
      },
    });
    await salesChannelsRepo.update(channel.id, { lastSyncAt: job.completedAt });
    if (type === 'orders' && imported > 0) {
      await notificationService.notify({
        type: 'success',
        priority: 'medium',
        title: 'New synced order',
        message: `${channel.name} sync imported ${imported} mock order placeholder.`,
        link: '/admin/orders',
        entityType: 'sync_job',
        entityId: job.id,
      });
    }
    await auditLogService.record(context, 'integrations.sync', 'sync_job', job.id, job);
    return job;
  }

  async function createManualConversation(context, payload) {
    const created = await conversationsRepo.create({
      id: payload.id || createId('conv'),
      channel: payload.channel || 'manual',
      contact: payload.contact || 'Manual contact',
      avatar: payload.avatar || '👤',
      unread: 0,
      lastMessage: payload.lastMessage || '',
      timestamp: now(),
      status: 'open',
      customerId: payload.customerId || '',
      messages: Array.isArray(payload.messages) ? payload.messages : [],
    });
    await auditLogService.record(context, 'social.conversation_create', 'conversation', created.id, created);
    return created;
  }

  async function convertConversationToLead(context, id) {
    const conversation = await conversationsRepo.getById(id);
    if (!conversation) throw new AppError(404, 'NOT_FOUND', 'Conversation not found');
    const lead = await leadsRepo.create({
      id: createId('lead'),
      name: conversation.contact,
      category: 'Social Inbox',
      phone: '',
      city: '',
      source: conversation.channel || 'manual',
      status: 'nouveau',
      notes: `Converted from conversation ${conversation.id}`,
    });
    await conversationsRepo.update(id, { leadId: lead.id });
    await auditLogService.record(context, 'social.convert_to_lead', 'conversation', id, { leadId: lead.id });
    return lead;
  }

  async function convertConversationToOrder(context, id) {
    const conversation = await conversationsRepo.getById(id);
    if (!conversation) throw new AppError(404, 'NOT_FOUND', 'Conversation not found');
    const order = await createOrder(context, {
      customer: conversation.contact,
      source: conversation.channel || 'manual',
      status: 'New',
      paymentStatus: 'Unpaid',
      deliveryStatus: 'Waiting',
      internalNotes: [{ id: createId('note'), text: `Converted from conversation ${conversation.id}`, createdAt: now() }],
      lineItems: [],
    });
    await conversationsRepo.update(id, { orderId: order.id });
    await auditLogService.record(context, 'social.convert_to_order', 'conversation', id, { orderId: order.id });
    return order;
  }

  async function linkConversationToCustomer(context, id, customerId) {
    const customer = await customersRepo.getById(customerId);
    if (!customer) throw new AppError(404, 'NOT_FOUND', 'Customer not found');
    const updated = await conversationsRepo.update(id, { customerId });
    await auditLogService.record(context, 'social.link_customer', 'conversation', id, { customerId });
    return updated;
  }

  return {
    listOrders,
    getOrder,
    createOrder,
    updateOrder,
    deleteOrder,
    listProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    adjustStock,
    listStockAlerts,
    listCustomers,
    getCustomer,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    addCustomerNote,
    addCustomerReminder,
    listDeliveries,
    getDelivery,
    createDelivery,
    updateDelivery,
    deleteDelivery,
    deliveryReport,
    createManualOrder,
    generateDeliveryNote,
    generateInvoice,
    accountingSummary,
    exportAccountingCsv,
    listMarketingCampaigns,
    getMarketingCampaign,
    createMarketingCampaign,
    updateMarketingCampaign,
    deleteMarketingCampaign,
    generateCopy,
    listAdCampaigns,
    getAdCampaign,
    createAdCampaign,
    updateAdCampaign,
    deleteAdCampaign,
    analyticsOverview,
    listSalesChannels,
    getSalesChannel,
    createSalesChannel,
    updateSalesChannel,
    deleteSalesChannel,
    runSync,
    createManualConversation,
    convertConversationToLead,
    convertConversationToOrder,
    linkConversationToCustomer,
  };
}
