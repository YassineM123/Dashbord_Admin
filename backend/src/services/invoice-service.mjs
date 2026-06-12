import { AppError } from '../core/errors.mjs';

export const INVOICE_STATUSES = ['Draft', 'Sent', 'Paid', 'Cancelled'];
export const INVOICE_PAYMENT_STATUSES = ['Unpaid', 'Paid', 'Cash on Delivery', 'Refunded'];

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

function roundMoney(value) {
  return Math.round(toNumber(value, 0) * 100) / 100;
}

function normalizeStatus(value, fallback = 'Draft') {
  const normalized = String(value || '').trim();
  if (normalized === 'Issued') return 'Sent';
  return INVOICE_STATUSES.includes(normalized) ? normalized : fallback;
}

function normalizePaymentStatus(value, fallback = 'Unpaid') {
  const normalized = String(value || '').trim();
  return INVOICE_PAYMENT_STATUSES.includes(normalized) ? normalized : fallback;
}

function toInvoiceNumberSequence(number) {
  const match = String(number || '').match(/INV-\d{4}-(\d+)$/);
  return match ? parseInt(match[1], 10) || 0 : 0;
}

function normalizeBusiness(settings) {
  return {
    name: settings?.store?.name || 'Ma Boutique E-commerce',
    email: settings?.store?.supportEmail || '',
    phone: settings?.store?.supportPhone || '',
    address: settings?.store?.address || '',
    taxId: settings?.store?.taxId || '',
  };
}

function normalizeCustomerFromOrder(order) {
  return {
    id: String(order.customerId || ''),
    name: String(order.customer || order.customerName || 'Customer'),
    email: String(order.email || ''),
    phone: String(order.phone || ''),
    address: String(order.address || ''),
    city: String(order.city || ''),
    country: String(order.country || 'Tunisia'),
  };
}

function normalizeLine(line, defaults = {}) {
  const quantity = Math.max(1, Math.trunc(toNumber(line.quantity, 1)));
  const unitPrice = roundMoney(line.unitPrice ?? line.price);
  const discountRate = Math.max(0, toNumber(line.discountRate, defaults.discountRate || 0));
  const taxRate = Math.max(0, toNumber(line.taxRate, defaults.taxRate || 0));
  const gross = roundMoney(quantity * unitPrice);
  const discountAmount = roundMoney(gross * (discountRate / 100));
  const taxable = Math.max(0, gross - discountAmount);
  const taxAmount = roundMoney(taxable * (taxRate / 100));
  const total = roundMoney(taxable + taxAmount);
  return {
    id: String(line.id || createId('invline')),
    productId: String(line.productId || ''),
    variantId: String(line.variantId || ''),
    name: String(line.name || 'Product'),
    sku: String(line.sku || ''),
    quantity,
    unitPrice,
    taxRate,
    taxAmount,
    discountRate,
    discountAmount,
    total,
  };
}

function calculateTotals(lines, deliveryFee) {
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
  const taxTotal = roundMoney(lines.reduce((sum, line) => sum + line.taxAmount, 0));
  const discountTotal = roundMoney(lines.reduce((sum, line) => sum + line.discountAmount, 0));
  const total = roundMoney(subtotal - discountTotal + taxTotal + toNumber(deliveryFee, 0));
  return { subtotal, taxTotal, discountTotal, total };
}

function normalizeInvoice(invoice, settings = {}) {
  const legacyLines = Array.isArray(invoice.lines)
    ? invoice.lines
    : Array.isArray(invoice.lineItems)
      ? invoice.lineItems
      : [];
  const lines = legacyLines.map((line) =>
    normalizeLine({
      ...line,
      unitPrice: line.unitPrice ?? line.price,
      taxRate: line.taxRate ?? 0,
      discountRate: line.discountRate ?? 0,
    })
  );
  const deliveryFee = roundMoney(invoice.deliveryFee);
  const totals = calculateTotals(lines, deliveryFee);
  return {
    ...invoice,
    id: String(invoice.id || createId('inv')),
    number: String(invoice.number || `INV-${Date.now().toString().slice(-8)}`),
    orderId: String(invoice.orderId || ''),
    customerId: String(invoice.customerId || invoice.customer?.id || ''),
    customerName: String(invoice.customerName || invoice.customer?.name || ''),
    business: invoice.business && typeof invoice.business === 'object' ? invoice.business : normalizeBusiness(settings),
    customer: invoice.customer && typeof invoice.customer === 'object'
      ? invoice.customer
      : {
          id: String(invoice.customerId || ''),
          name: String(invoice.customerName || ''),
          email: '',
          phone: '',
          address: '',
          city: '',
          country: '',
        },
    lines,
    currency: invoice.currency || settings?.payments?.currency || 'TND',
    status: normalizeStatus(invoice.status),
    paymentStatus: normalizePaymentStatus(invoice.paymentStatus),
    issueDate: invoice.issueDate || invoice.createdAt || now(),
    sentAt: invoice.sentAt || '',
    paidAt: invoice.paidAt || '',
    cancelledAt: invoice.cancelledAt || '',
    deliveryFee,
    subtotal: roundMoney(invoice.subtotal || totals.subtotal),
    taxTotal: roundMoney(invoice.taxTotal || totals.taxTotal),
    discountTotal: roundMoney(invoice.discountTotal || totals.discountTotal),
    total: roundMoney(invoice.total || totals.total),
    createdAt: invoice.createdAt || now(),
    updatedAt: invoice.updatedAt || invoice.createdAt || now(),
    sendPlaceholder: invoice.sendPlaceholder || null,
  };
}

export function createInvoiceService({ invoicesRepo, settingsRepo, ecommerceService, auditLogService, pdfGenerationService, notificationService }) {
  async function getSettings() {
    return settingsRepo?.getAll ? settingsRepo.getAll() : {};
  }

  async function nextInvoiceNumber() {
    const year = new Date().getFullYear();
    const rows = await invoicesRepo.list();
    const maxSequence = rows
      .filter((row) => String(row.number || '').startsWith(`INV-${year}-`))
      .reduce((max, row) => Math.max(max, toInvoiceNumberSequence(row.number)), 0);
    return `INV-${year}-${String(maxSequence + 1).padStart(4, '0')}`;
  }

  async function listInvoices(filters = {}) {
    const settings = await getSettings();
    let rows = (await invoicesRepo.list()).map((invoice) => normalizeInvoice(invoice, settings));
    if (filters.status) rows = rows.filter((invoice) => invoice.status === filters.status);
    if (filters.customer) {
      const query = String(filters.customer).toLowerCase();
      rows = rows.filter((invoice) =>
        [invoice.customer?.name, invoice.customer?.email, invoice.customerName, invoice.customerId].some((value) =>
          String(value || '').toLowerCase().includes(query)
        )
      );
    }
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom).getTime();
      if (Number.isFinite(from)) rows = rows.filter((invoice) => new Date(invoice.issueDate || invoice.createdAt).getTime() >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo).getTime() + 86_399_999;
      if (Number.isFinite(to)) rows = rows.filter((invoice) => new Date(invoice.issueDate || invoice.createdAt).getTime() <= to);
    }
    return rows.sort((left, right) => String(right.issueDate).localeCompare(String(left.issueDate)));
  }

  async function getInvoice(id) {
    const row = await invoicesRepo.getById(id);
    if (!row) return null;
    return normalizeInvoice(row, await getSettings());
  }

  async function createFromOrder(context, payload = {}) {
    const orderId = String(payload.orderId || '').trim();
    if (!orderId) throw new AppError(400, 'VALIDATION_ERROR', 'orderId is required');
    const order = await ecommerceService.getOrder(orderId);
    if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');
    const settings = await getSettings();
    const taxRate = Math.max(0, toNumber(payload.taxRate, 0));
    const discountRate = Math.max(0, toNumber(payload.discountRate, 0));
    const lines = (order.lineItems || []).map((item) =>
      normalizeLine(
        {
          ...item,
          unitPrice: item.unitPrice,
          taxRate,
          discountRate,
        },
        { taxRate, discountRate }
      )
    );
    if (!lines.length) throw new AppError(400, 'VALIDATION_ERROR', 'Order has no product lines');
    const deliveryFee = roundMoney(payload.deliveryFee ?? order.deliveryFee ?? 0);
    const totals = calculateTotals(lines, deliveryFee);
    const paymentStatus = normalizePaymentStatus(payload.paymentStatus || order.paymentStatus || order.payment, 'Unpaid');
    const status = normalizeStatus(payload.status || (paymentStatus === 'Paid' ? 'Paid' : 'Draft'));
    const timestamp = now();
    const invoice = normalizeInvoice(
      {
        id: payload.id || createId('inv'),
        number: payload.number || (await nextInvoiceNumber()),
        orderId: order.id,
        customerId: order.customerId,
        customerName: order.customer,
        customer: normalizeCustomerFromOrder(order),
        business: normalizeBusiness(settings),
        lines,
        currency: settings?.payments?.currency || 'TND',
        status,
        paymentStatus,
        issueDate: payload.issueDate || timestamp,
        deliveryFee,
        ...totals,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      settings
    );
    const created = await invoicesRepo.create(invoice);
    await auditLogService.record(context, 'invoices.create_from_order', 'invoice', created.id, { orderId: order.id, number: created.number });
    await notificationService.notify({
      type: 'success',
      priority: 'medium',
      title: 'Invoice generated',
      message: `${created.number} generated for ${created.customer?.name || created.customerName || order.customer}.`,
      link: `/admin/invoices?invoice=${encodeURIComponent(created.id)}`,
      entityType: 'invoice',
      entityId: created.id,
    });
    return created;
  }

  async function updateInvoice(context, id, patch = {}) {
    const current = await getInvoice(id);
    if (!current) throw new AppError(404, 'NOT_FOUND', 'Invoice not found');
    const settings = await getSettings();
    const status = patch.status ? normalizeStatus(patch.status, '') : current.status;
    if (!status) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid invoice status');
    const paymentStatus = patch.paymentStatus ? normalizePaymentStatus(patch.paymentStatus, '') : current.paymentStatus;
    if (!paymentStatus) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid payment status');
    const lines = Array.isArray(patch.lines) ? patch.lines.map(normalizeLine) : current.lines;
    const deliveryFee = patch.deliveryFee === undefined ? current.deliveryFee : roundMoney(patch.deliveryFee);
    const totals = calculateTotals(lines, deliveryFee);
    const timestamp = now();
    const updated = await invoicesRepo.update(
      id,
      normalizeInvoice(
        {
          ...current,
          ...patch,
          lines,
          status,
          paymentStatus,
          deliveryFee,
          ...totals,
          sentAt: status === 'Sent' && !current.sentAt ? timestamp : current.sentAt,
          paidAt: status === 'Paid' && !current.paidAt ? timestamp : current.paidAt,
          cancelledAt: status === 'Cancelled' && !current.cancelledAt ? timestamp : current.cancelledAt,
          updatedAt: timestamp,
        },
        settings
      )
    );
    if (status === 'Paid' && current.status !== 'Paid') {
      await notificationService.notify({
        type: 'success',
        priority: 'medium',
        title: 'Invoice paid',
        message: `${updated.number} marked as paid.`,
        link: `/admin/invoices?invoice=${encodeURIComponent(updated.id)}`,
        entityType: 'invoice',
        entityId: updated.id,
        dedupeKey: `invoice_paid:${updated.id}`,
      });
    }
    await auditLogService.record(context, 'invoices.update', 'invoice', id, patch);
    return updated;
  }

  async function sendPlaceholder(context, id, payload = {}) {
    const invoice = await getInvoice(id);
    if (!invoice) throw new AppError(404, 'NOT_FOUND', 'Invoice not found');
    const sentAt = now();
    const updated = await updateInvoice(context, id, {
      status: invoice.status === 'Draft' ? 'Sent' : invoice.status,
      sendPlaceholder: {
        to: payload.to || invoice.customer?.email || '',
        channel: payload.channel || 'email',
        message: payload.message || `Invoice ${invoice.number} ready for review.`,
        sentAt,
        mode: 'placeholder',
      },
    });
    await auditLogService.record(context, 'invoices.send_placeholder', 'invoice', id, updated.sendPlaceholder);
    return updated;
  }

  async function createPdf(context, id) {
    const invoice = await getInvoice(id);
    if (!invoice) throw new AppError(404, 'NOT_FOUND', 'Invoice not found');
    const pdf = pdfGenerationService.createInvoicePdf(invoice);
    await auditLogService.record(context, 'invoices.download_pdf', 'invoice', id, { number: invoice.number });
    return pdf;
  }

  async function deleteInvoice(context, id) {
    const invoice = await getInvoice(id);
    if (!invoice) throw new AppError(404, 'NOT_FOUND', 'Invoice not found');
    const deleted = await invoicesRepo.remove(id);
    await auditLogService.record(context, 'invoices.delete', 'invoice', id, {
      number: invoice.number,
      orderId: invoice.orderId,
      total: invoice.total,
    });
    return normalizeInvoice(deleted, await getSettings());
  }

  return {
    listInvoices,
    getInvoice,
    createFromOrder,
    updateInvoice,
    sendPlaceholder,
    createPdf,
    deleteInvoice,
  };
}
