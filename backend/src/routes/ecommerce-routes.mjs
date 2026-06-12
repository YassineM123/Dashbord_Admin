import { AppError } from '../core/errors.mjs';
import { requirePermission } from '../core/permissions.mjs';
import { assertObject, enumValue, paginate } from '../core/validation.mjs';
import {
  AD_PLATFORMS,
  CAMPAIGN_STATUSES,
  DELIVERY_STATUSES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  SALES_CHANNEL_PROVIDERS,
} from '../services/ecommerce-service.mjs';
import { INVOICE_PAYMENT_STATUSES, INVOICE_STATUSES } from '../services/invoice-service.mjs';

function cleanBody(body) {
  return assertObject(body || {}, 'Invalid JSON payload');
}

function queryFilters(query, fields) {
  return fields.reduce((acc, field) => {
    if (query[field]) acc[field] = String(query[field]);
    return acc;
  }, {});
}

export function registerEcommerceRoutes(router, deps) {
  const { ecommerceService, invoiceService, deliveryNoteService, accountingService, integrationSettingsService, auditLogsRepo, stockMovementsRepo, marketingTemplatesRepo } = deps;

  router.register('GET', '/api/permissions/me', async (context) => {
    return {
      status: 200,
      data: {
        role: context.user.role,
      },
    };
  });

  router.register('GET', '/api/audit-logs', async (context) => {
    requirePermission(context, 'analytics.read');
    const rows = await auditLogsRepo.list();
    const filtered = rows
      .filter((row) => (context.query.entityType ? row.entityType === context.query.entityType : true))
      .filter((row) => (context.query.action ? row.action === context.query.action : true))
      .sort((left, right) => String(right.timestamp).localeCompare(String(left.timestamp)));
    const page = paginate(filtered, context.query, queryFilters(context.query, ['entityType', 'action']));
    return { status: 200, data: page.data, meta: page.meta };
  });

  router.register('GET', '/api/orders', async (context) => {
    requirePermission(context, 'orders.read');
    const filters = queryFilters(context.query, ['status', 'paymentStatus', 'deliveryStatus', 'search']);
    if (filters.status) filters.status = enumValue(filters.status, ORDER_STATUSES, 'status');
    if (filters.paymentStatus) filters.paymentStatus = enumValue(filters.paymentStatus, PAYMENT_STATUSES, 'paymentStatus');
    if (filters.deliveryStatus) filters.deliveryStatus = enumValue(filters.deliveryStatus, DELIVERY_STATUSES, 'deliveryStatus');
    const rows = await ecommerceService.listOrders(filters);
    const page = paginate(rows, context.query, filters);
    return { status: 200, data: page.data, meta: page.meta };
  });

  router.register('GET', '/api/orders/:id', async (context) => {
    requirePermission(context, 'orders.read');
    const order = await ecommerceService.getOrder(context.params.id);
    if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');
    return { status: 200, data: order };
  });

  router.register('POST', '/api/orders', async (context) => {
    requirePermission(context, 'orders.write');
    const order = await ecommerceService.createOrder(context, cleanBody(await context.getBody()));
    return { status: 201, data: order };
  });

  router.register('POST', '/api/orders/manual', async (context) => {
    requirePermission(context, 'orders.write');
    const order = await ecommerceService.createManualOrder(context, cleanBody(await context.getBody()));
    return { status: 201, data: order };
  });

  router.register('PATCH', '/api/orders/:id', async (context) => {
    requirePermission(context, 'orders.write');
    const updated = await ecommerceService.updateOrder(context, context.params.id, cleanBody(await context.getBody()));
    return { status: 200, data: updated };
  });

  router.register('DELETE', '/api/orders/:id', async (context) => {
    requirePermission(context, 'orders.write');
    const deleted = await ecommerceService.deleteOrder(context, context.params.id);
    return { status: 200, data: deleted };
  });

  router.register('GET', '/api/products', async (context) => {
    requirePermission(context, 'products.read');
    let rows = await ecommerceService.listProducts();
    const search = String(context.query.search || context.query.q || '').toLowerCase();
    if (search) {
      rows = rows.filter((product) => [product.name, product.sku, product.category].some((value) => String(value).toLowerCase().includes(search)));
    }
    const page = paginate(rows, context.query, { search });
    return { status: 200, data: page.data, meta: page.meta };
  });

  router.register('GET', '/api/products/:id', async (context) => {
    requirePermission(context, 'products.read');
    const product = (await ecommerceService.listProducts()).find((entry) => String(entry.id) === String(context.params.id));
    if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found');
    return { status: 200, data: product };
  });

  router.register('POST', '/api/products', async (context) => {
    requirePermission(context, 'products.write');
    const product = await ecommerceService.createProduct(context, cleanBody(await context.getBody()));
    return { status: 201, data: product };
  });

  router.register('PATCH', '/api/products/:id', async (context) => {
    requirePermission(context, 'products.write');
    const product = await ecommerceService.updateProduct(context, context.params.id, cleanBody(await context.getBody()));
    return { status: 200, data: product };
  });

  router.register('DELETE', '/api/products/:id', async (context) => {
    requirePermission(context, 'products.write');
    const product = await ecommerceService.deleteProduct(context, context.params.id);
    return { status: 200, data: product };
  });

  router.register('POST', '/api/products/:id/stock-movements', async (context) => {
    requirePermission(context, 'stock.write');
    const result = await ecommerceService.adjustStock(context, context.params.id, cleanBody(await context.getBody()));
    return { status: 201, data: result };
  });

  router.register('GET', '/api/stock/movements', async (context) => {
    requirePermission(context, 'stock.read');
    let rows = await stockMovementsRepo.list();
    if (context.query.productId) rows = rows.filter((entry) => String(entry.productId) === String(context.query.productId));
    if (context.query.type) rows = rows.filter((entry) => String(entry.type) === String(context.query.type));
    if (context.query.dateFrom) {
      const from = new Date(context.query.dateFrom).getTime();
      if (Number.isFinite(from)) rows = rows.filter((entry) => new Date(entry.createdAt || 0).getTime() >= from);
    }
    if (context.query.dateTo) {
      const to = new Date(context.query.dateTo).getTime() + 86_399_999;
      if (Number.isFinite(to)) rows = rows.filter((entry) => new Date(entry.createdAt || 0).getTime() <= to);
    }
    const page = paginate(
      rows.sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt))),
      context.query,
      queryFilters(context.query, ['productId', 'type', 'dateFrom', 'dateTo'])
    );
    return { status: 200, data: page.data, meta: page.meta };
  });

  router.register('GET', '/api/stock/alerts', async (context) => {
    requirePermission(context, 'stock.read');
    const rows = await ecommerceService.listStockAlerts();
    return { status: 200, data: rows, meta: { total: rows.length } };
  });

  router.register('GET', '/api/customers', async (context) => {
    requirePermission(context, 'customers.read');
    let rows = await ecommerceService.listCustomers();
    const search = String(context.query.search || context.query.q || '').toLowerCase();
    if (search) {
      rows = rows.filter((customer) => [customer.name, customer.email, customer.phone, customer.city].some((value) => String(value).toLowerCase().includes(search)));
    }
    if (context.query.segment) rows = rows.filter((customer) => customer.segment === context.query.segment);
    const page = paginate(rows, context.query, queryFilters(context.query, ['search', 'segment']));
    return { status: 200, data: page.data, meta: page.meta };
  });

  router.register('GET', '/api/customers/:id', async (context) => {
    requirePermission(context, 'customers.read');
    const customer = await ecommerceService.getCustomer(context.params.id);
    if (!customer) throw new AppError(404, 'NOT_FOUND', 'Customer not found');
    return { status: 200, data: customer };
  });

  router.register('POST', '/api/customers', async (context) => {
    requirePermission(context, 'customers.write');
    const customer = await ecommerceService.createCustomer(context, cleanBody(await context.getBody()));
    return { status: 201, data: customer };
  });

  router.register('PATCH', '/api/customers/:id', async (context) => {
    requirePermission(context, 'customers.write');
    const customer = await ecommerceService.updateCustomer(context, context.params.id, cleanBody(await context.getBody()));
    return { status: 200, data: customer };
  });

  router.register('DELETE', '/api/customers/:id', async (context) => {
    requirePermission(context, 'customers.write');
    const customer = await ecommerceService.deleteCustomer(context, context.params.id);
    return { status: 200, data: customer };
  });

  router.register('POST', '/api/customers/:id/notes', async (context) => {
    requirePermission(context, 'customers.write');
    const customer = await ecommerceService.addCustomerNote(context, context.params.id, cleanBody(await context.getBody()).text);
    return { status: 201, data: customer };
  });

  router.register('POST', '/api/customers/:id/reminders', async (context) => {
    requirePermission(context, 'customers.write');
    const customer = await ecommerceService.addCustomerReminder(context, context.params.id, cleanBody(await context.getBody()));
    return { status: 201, data: customer };
  });

  router.register('GET', '/api/deliveries', async (context) => {
    requirePermission(context, 'delivery.read');
    const filters = queryFilters(context.query, ['status', 'city']);
    if (filters.status) filters.status = enumValue(filters.status, DELIVERY_STATUSES, 'status');
    const rows = await ecommerceService.listDeliveries(filters);
    const page = paginate(rows, context.query, filters);
    return { status: 200, data: page.data, meta: page.meta };
  });

  router.register('GET', '/api/deliveries/:id', async (context) => {
    requirePermission(context, 'delivery.read');
    const delivery = await ecommerceService.getDelivery(context.params.id);
    if (!delivery) throw new AppError(404, 'NOT_FOUND', 'Delivery not found');
    return { status: 200, data: delivery };
  });

  router.register('POST', '/api/deliveries', async (context) => {
    requirePermission(context, 'delivery.write');
    const delivery = await ecommerceService.createDelivery(context, cleanBody(await context.getBody()));
    return { status: 201, data: delivery };
  });

  router.register('PATCH', '/api/deliveries/:id', async (context) => {
    requirePermission(context, 'delivery.write');
    const delivery = await ecommerceService.updateDelivery(context, context.params.id, cleanBody(await context.getBody()));
    return { status: 200, data: delivery };
  });

  router.register('DELETE', '/api/deliveries/:id', async (context) => {
    requirePermission(context, 'delivery.write');
    const delivery = await ecommerceService.deleteDelivery(context, context.params.id);
    return { status: 200, data: delivery };
  });

  router.register('GET', '/api/deliveries/report/daily', async (context) => {
    requirePermission(context, 'delivery.read');
    const report = await ecommerceService.deliveryReport(context.query.date);
    return { status: 200, data: report };
  });

  router.register('GET', '/api/invoices', async (context) => {
    requirePermission(context, 'invoices.read');
    const filters = queryFilters(context.query, ['status', 'dateFrom', 'dateTo', 'customer']);
    if (filters.status) filters.status = enumValue(filters.status, INVOICE_STATUSES, 'status');
    const rows = await invoiceService.listInvoices(filters);
    const page = paginate(rows, context.query, filters);
    return { status: 200, data: page.data, meta: page.meta };
  });

  router.register('GET', '/api/invoices/:id', async (context) => {
    requirePermission(context, 'invoices.read');
    const invoice = await invoiceService.getInvoice(context.params.id);
    if (!invoice) throw new AppError(404, 'NOT_FOUND', 'Invoice not found');
    return { status: 200, data: invoice };
  });

  router.register('POST', '/api/invoices', async (context) => {
    requirePermission(context, 'invoices.write');
    const body = cleanBody(await context.getBody());
    if (body.status) enumValue(body.status, INVOICE_STATUSES, 'status');
    if (body.paymentStatus) enumValue(body.paymentStatus, INVOICE_PAYMENT_STATUSES, 'paymentStatus');
    const invoice = await invoiceService.createFromOrder(context, body);
    return { status: 201, data: invoice };
  });

  router.register('POST', '/api/invoices/generate', async (context) => {
    requirePermission(context, 'invoices.write');
    const body = cleanBody(await context.getBody());
    const invoice = await invoiceService.createFromOrder(context, body);
    return { status: 201, data: invoice };
  });

  router.register('POST', '/api/orders/:id/delivery-note', async (context) => {
    requirePermission(context, 'invoices.write');
    const note = await deliveryNoteService.generateFromOrder(context, context.params.id);
    return { status: 201, data: note };
  });

  router.register('PATCH', '/api/invoices/:id', async (context) => {
    requirePermission(context, 'invoices.write');
    const body = cleanBody(await context.getBody());
    if (body.status) enumValue(body.status, INVOICE_STATUSES, 'status');
    if (body.paymentStatus) enumValue(body.paymentStatus, INVOICE_PAYMENT_STATUSES, 'paymentStatus');
    const invoice = await invoiceService.updateInvoice(context, context.params.id, body);
    return { status: 200, data: invoice };
  });

  router.register('DELETE', '/api/invoices/:id', async (context) => {
    requirePermission(context, 'invoices.write');
    const invoice = await invoiceService.deleteInvoice(context, context.params.id);
    return { status: 200, data: invoice };
  });

  router.register('POST', '/api/invoices/:id/send', async (context) => {
    requirePermission(context, 'invoices.write');
    const invoice = await invoiceService.sendPlaceholder(context, context.params.id, cleanBody(await context.getBody()));
    return { status: 200, data: invoice };
  });

  router.register('GET', '/api/invoices/:id/pdf', async (context) => {
    requirePermission(context, 'invoices.read');
    const pdf = await invoiceService.createPdf(context, context.params.id);
    return { status: 200, data: pdf };
  });

  router.register('GET', '/api/accounting/summary', async (context) => {
    requirePermission(context, 'invoices.read');
    const summary = await accountingService.summary();
    return { status: 200, data: summary };
  });

  router.register('GET', '/api/accounting/dashboard', async (context) => {
    requirePermission(context, 'invoices.read');
    const dashboard = await accountingService.dashboard();
    return { status: 200, data: dashboard };
  });

  router.register('GET', '/api/accounting/export.csv', async (context) => {
    requirePermission(context, 'invoices.read');
    const csv = await accountingService.exportCsv(context);
    return { status: 200, data: { filename: `accounting-${new Date().toISOString().slice(0, 10)}.csv`, contentType: 'text/csv', content: csv } };
  });

  router.register('GET', '/api/delivery-notes', async (context) => {
    requirePermission(context, 'invoices.read');
    const filters = queryFilters(context.query, ['status', 'dateFrom', 'dateTo', 'customer', 'orderId']);
    if (filters.status) filters.status = enumValue(filters.status, DELIVERY_STATUSES, 'status');
    const rows = await deliveryNoteService.listDeliveryNotes(filters);
    const page = paginate(rows, context.query, filters);
    return { status: 200, data: page.data, meta: page.meta };
  });

  router.register('GET', '/api/delivery-notes/:id', async (context) => {
    requirePermission(context, 'invoices.read');
    const note = await deliveryNoteService.getDeliveryNote(context.params.id);
    if (!note) throw new AppError(404, 'NOT_FOUND', 'Delivery note not found');
    return { status: 200, data: note };
  });

  router.register('POST', '/api/delivery-notes/generate', async (context) => {
    requirePermission(context, 'invoices.write');
    const body = cleanBody(await context.getBody());
    const note = await deliveryNoteService.generateFromOrder(context, body.orderId);
    return { status: 201, data: note };
  });

  router.register('PATCH', '/api/delivery-notes/:id', async (context) => {
    requirePermission(context, 'invoices.write');
    const body = cleanBody(await context.getBody());
    if (body.status) enumValue(body.status, DELIVERY_STATUSES, 'status');
    if (body.deliveryStatus) enumValue(body.deliveryStatus, DELIVERY_STATUSES, 'deliveryStatus');
    const note = await deliveryNoteService.updateDeliveryNote(context, context.params.id, body);
    return { status: 200, data: note };
  });

  router.register('DELETE', '/api/delivery-notes/:id', async (context) => {
    requirePermission(context, 'invoices.write');
    const note = await deliveryNoteService.deleteDeliveryNote(context, context.params.id);
    return { status: 200, data: note };
  });

  router.register('GET', '/api/delivery-notes/:id/pdf', async (context) => {
    requirePermission(context, 'invoices.read');
    const pdf = await deliveryNoteService.createPdf(context, context.params.id);
    return { status: 200, data: pdf };
  });

  router.register('GET', '/api/expenses', async (context) => {
    requirePermission(context, 'invoices.read');
    const filters = queryFilters(context.query, ['category', 'dateFrom', 'dateTo']);
    const rows = await accountingService.listExpenses(filters);
    const page = paginate(rows, context.query, filters);
    return { status: 200, data: page.data, meta: page.meta };
  });

  router.register('POST', '/api/expenses', async (context) => {
    requirePermission(context, 'invoices.write');
    const expense = await accountingService.createExpense(context, cleanBody(await context.getBody()));
    return { status: 201, data: expense };
  });

  router.register('PATCH', '/api/expenses/:id', async (context) => {
    requirePermission(context, 'invoices.write');
    const expense = await accountingService.updateExpense(context, context.params.id, cleanBody(await context.getBody()));
    return { status: 200, data: expense };
  });

  router.register('DELETE', '/api/expenses/:id', async (context) => {
    requirePermission(context, 'invoices.write');
    const expense = await accountingService.deleteExpense(context, context.params.id);
    return { status: 200, data: expense };
  });

  router.register('GET', '/api/social/conversations', async (context) => {
    requirePermission(context, 'social.read');
    const rows = await deps.conversationsRepo.list();
    const page = paginate(rows, context.query, {});
    return { status: 200, data: page.data, meta: page.meta };
  });

  router.register('POST', '/api/social/conversations', async (context) => {
    requirePermission(context, 'social.write');
    const conversation = await ecommerceService.createManualConversation(context, cleanBody(await context.getBody()));
    return { status: 201, data: conversation };
  });

  router.register('POST', '/api/social/conversations/:id/convert-to-lead', async (context) => {
    requirePermission(context, 'social.write');
    const lead = await ecommerceService.convertConversationToLead(context, context.params.id);
    return { status: 201, data: lead };
  });

  router.register('POST', '/api/social/conversations/:id/convert-to-order', async (context) => {
    requirePermission(context, 'social.write');
    const order = await ecommerceService.convertConversationToOrder(context, context.params.id);
    return { status: 201, data: order };
  });

  router.register('POST', '/api/social/conversations/:id/link-customer', async (context) => {
    requirePermission(context, 'social.write');
    const body = cleanBody(await context.getBody());
    const conversation = await ecommerceService.linkConversationToCustomer(context, context.params.id, body.customerId);
    return { status: 200, data: conversation };
  });

  router.register('GET', '/api/marketing/campaigns', async (context) => {
    requirePermission(context, 'marketing.read');
    let rows = await ecommerceService.listMarketingCampaigns();
    if (context.query.status) rows = rows.filter((campaign) => campaign.status === context.query.status);
    const page = paginate(rows, context.query, queryFilters(context.query, ['status']));
    return { status: 200, data: page.data, meta: page.meta };
  });

  router.register('GET', '/api/marketing/campaigns/:id', async (context) => {
    requirePermission(context, 'marketing.read');
    const campaign = await ecommerceService.getMarketingCampaign(context.params.id);
    if (!campaign) throw new AppError(404, 'NOT_FOUND', 'Marketing campaign not found');
    return { status: 200, data: campaign };
  });

  router.register('POST', '/api/marketing/campaigns', async (context) => {
    requirePermission(context, 'marketing.write');
    const body = cleanBody(await context.getBody());
    if (body.status) enumValue(body.status, CAMPAIGN_STATUSES, 'status');
    const campaign = await ecommerceService.createMarketingCampaign(context, body);
    return { status: 201, data: campaign };
  });

  router.register('POST', '/api/marketing/abandoned-cart/detect', async (context) => {
    requirePermission(context, 'marketing.write');
    const body = cleanBody(await context.getBody());
    const customer = String(body.customer || body.customerName || 'Customer');
    const value = Number(body.value || body.amount || 0);
    const note = await deps.notificationService.notify({
      type: 'warning',
      priority: value >= 200 ? 'high' : 'medium',
      title: 'Abandoned cart detected',
      message: `${customer} abandoned a cart${value ? ` worth ${value} TND` : ''}.`,
      link: '/admin/email-sms',
      entityType: 'abandoned_cart',
      entityId: String(body.cartId || body.id || ''),
      dedupeKey: body.cartId ? `abandoned_cart:${body.cartId}` : '',
    });
    return { status: 201, data: note };
  });

  router.register('PATCH', '/api/marketing/campaigns/:id', async (context) => {
    requirePermission(context, 'marketing.write');
    const campaign = await ecommerceService.updateMarketingCampaign(context, context.params.id, cleanBody(await context.getBody()));
    return { status: 200, data: campaign };
  });

  router.register('DELETE', '/api/marketing/campaigns/:id', async (context) => {
    requirePermission(context, 'marketing.write');
    const campaign = await ecommerceService.deleteMarketingCampaign(context, context.params.id);
    return { status: 200, data: campaign };
  });

  router.register('GET', '/api/marketing/templates', async (context) => {
    requirePermission(context, 'marketing.read');
    const rows = await marketingTemplatesRepo.list();
    return { status: 200, data: rows, meta: { total: rows.length } };
  });

  router.register('POST', '/api/marketing/generate-copy', async (context) => {
    requirePermission(context, 'marketing.write');
    const copy = ecommerceService.generateCopy(cleanBody(await context.getBody()), 'email');
    return { status: 200, data: copy };
  });

  router.register('GET', '/api/ads/campaigns', async (context) => {
    requirePermission(context, 'ads.read');
    let rows = await ecommerceService.listAdCampaigns();
    if (context.query.platform) rows = rows.filter((campaign) => campaign.platform === context.query.platform);
    const page = paginate(rows, context.query, queryFilters(context.query, ['platform']));
    return { status: 200, data: page.data, meta: page.meta };
  });

  router.register('GET', '/api/ads/campaigns/:id', async (context) => {
    requirePermission(context, 'ads.read');
    const campaign = await ecommerceService.getAdCampaign(context.params.id);
    if (!campaign) throw new AppError(404, 'NOT_FOUND', 'Ad campaign not found');
    return { status: 200, data: campaign };
  });

  router.register('POST', '/api/ads/campaigns', async (context) => {
    requirePermission(context, 'ads.write');
    const body = cleanBody(await context.getBody());
    if (body.platform) enumValue(body.platform, AD_PLATFORMS, 'platform');
    const campaign = await ecommerceService.createAdCampaign(context, body);
    return { status: 201, data: campaign };
  });

  router.register('PATCH', '/api/ads/campaigns/:id', async (context) => {
    requirePermission(context, 'ads.write');
    const campaign = await ecommerceService.updateAdCampaign(context, context.params.id, cleanBody(await context.getBody()));
    return { status: 200, data: campaign };
  });

  router.register('DELETE', '/api/ads/campaigns/:id', async (context) => {
    requirePermission(context, 'ads.write');
    const campaign = await ecommerceService.deleteAdCampaign(context, context.params.id);
    return { status: 200, data: campaign };
  });

  router.register('POST', '/api/ads/generate-copy', async (context) => {
    requirePermission(context, 'ads.write');
    const copy = ecommerceService.generateCopy(cleanBody(await context.getBody()), 'ad');
    return { status: 200, data: copy };
  });

  router.register('GET', '/api/analytics/overview', async (context) => {
    requirePermission(context, 'analytics.read');
    const data = await ecommerceService.analyticsOverview();
    return { status: 200, data };
  });

  router.register('GET', '/api/integrations/settings', async (context) => {
    requirePermission(context, 'integrations.read');
    const rows = await integrationSettingsService.listIntegrations();
    return { status: 200, data: rows, meta: { total: rows.length } };
  });

  router.register('GET', '/api/integrations/health', async (context) => {
    requirePermission(context, 'integrations.read');
    const health = await integrationSettingsService.health();
    return { status: 200, data: health };
  });

  router.register('POST', '/api/integrations/:id/connect', async (context) => {
    requirePermission(context, 'integrations.write');
    const integration = await integrationSettingsService.connect(context, context.params.id, cleanBody(await context.getBody()));
    return { status: 200, data: integration };
  });

  router.register('POST', '/api/integrations/:id/disconnect', async (context) => {
    requirePermission(context, 'integrations.write');
    const integration = await integrationSettingsService.disconnect(context, context.params.id);
    return { status: 200, data: integration };
  });

  router.register('POST', '/api/integrations/:id/test', async (context) => {
    requirePermission(context, 'integrations.read');
    const integration = await integrationSettingsService.testConnection(context, context.params.id);
    return { status: 200, data: integration };
  });

  router.register('GET', '/api/sales-channels', async (context) => {
    requirePermission(context, 'integrations.read');
    const rows = await ecommerceService.listSalesChannels();
    return { status: 200, data: rows, meta: { total: rows.length } };
  });

  router.register('GET', '/api/sales-channels/:id', async (context) => {
    requirePermission(context, 'integrations.read');
    const channel = await ecommerceService.getSalesChannel(context.params.id);
    if (!channel) throw new AppError(404, 'NOT_FOUND', 'Sales channel not found');
    return { status: 200, data: channel };
  });

  router.register('POST', '/api/sales-channels', async (context) => {
    requirePermission(context, 'integrations.write');
    const body = cleanBody(await context.getBody());
    if (body.provider) enumValue(body.provider, SALES_CHANNEL_PROVIDERS, 'provider');
    const channel = await ecommerceService.createSalesChannel(context, body);
    return { status: 201, data: channel };
  });

  router.register('PATCH', '/api/sales-channels/:id', async (context) => {
    requirePermission(context, 'integrations.write');
    const channel = await ecommerceService.updateSalesChannel(context, context.params.id, cleanBody(await context.getBody()));
    return { status: 200, data: channel };
  });

  router.register('DELETE', '/api/sales-channels/:id', async (context) => {
    requirePermission(context, 'integrations.write');
    const channel = await ecommerceService.deleteSalesChannel(context, context.params.id);
    return { status: 200, data: channel };
  });

  router.register('POST', '/api/sales-channels/:id/sync-products', async (context) => {
    requirePermission(context, 'integrations.write');
    const job = await ecommerceService.runSync(context, context.params.id, 'products');
    return { status: 202, data: job };
  });

  router.register('POST', '/api/sales-channels/:id/sync-orders', async (context) => {
    requirePermission(context, 'integrations.write');
    const job = await ecommerceService.runSync(context, context.params.id, 'orders');
    return { status: 202, data: job };
  });

  router.register('GET', '/api/sync-jobs', async (context) => {
    requirePermission(context, 'integrations.read');
    const rows = await deps.syncJobsRepo.list();
    const page = paginate(rows.sort((left, right) => String(right.startedAt).localeCompare(String(left.startedAt))), context.query, {});
    return { status: 200, data: page.data, meta: page.meta };
  });

  router.register('GET', '/api/sync-jobs/:id', async (context) => {
    requirePermission(context, 'integrations.read');
    const job = await deps.syncJobsRepo.getById(context.params.id);
    if (!job) throw new AppError(404, 'NOT_FOUND', 'Sync job not found');
    return { status: 200, data: job };
  });
}
