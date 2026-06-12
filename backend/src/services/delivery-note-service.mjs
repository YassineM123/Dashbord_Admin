import { AppError } from '../core/errors.mjs';
import { DELIVERY_STATUSES } from './ecommerce-service.mjs';

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

function normalizeDeliveryStatus(value) {
  const normalized = String(value || '').trim();
  return DELIVERY_STATUSES.includes(normalized) ? normalized : 'Waiting';
}

function toDeliveryNoteSequence(number) {
  const match = String(number || '').match(/BL-\d{4}-(\d+)$/);
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

function normalizeCustomerFromOrder(order, note = {}) {
  return {
    id: String(order.customerId || note.customerId || ''),
    name: String(order.customer || order.customerName || note.customerName || 'Customer'),
    phone: String(order.phone || note.phone || ''),
    email: String(order.email || note.email || ''),
    address: String(order.address || note.address || ''),
    city: String(order.city || note.city || ''),
    country: String(order.country || note.country || 'Tunisia'),
  };
}

function normalizeLine(line) {
  const quantity = Math.max(1, Math.trunc(toNumber(line.quantity, 1)));
  return {
    id: String(line.id || createId('dnline')),
    productId: String(line.productId || ''),
    variantId: String(line.variantId || ''),
    name: String(line.name || 'Product'),
    sku: String(line.sku || ''),
    size: String(line.size || ''),
    color: String(line.color || ''),
    material: String(line.material || ''),
    quantity,
  };
}

function normalizeDeliveryInfo(order = {}, delivery = {}, note = {}) {
  return {
    id: String(delivery.id || order.deliveryId || note.deliveryId || ''),
    company: String(delivery.company || order.deliveryCompanyName || order.courier || note.deliveryCompany || ''),
    driverName: String(delivery.driverName || order.driverName || note.driverName || ''),
    driverPhone: String(delivery.driverPhone || order.driverPhone || note.driverPhone || ''),
    trackingNumber: String(delivery.trackingNumber || order.trackingNumber || order.tracking || note.trackingNumber || ''),
    status: normalizeDeliveryStatus(delivery.status || order.deliveryStatus || note.deliveryStatus || note.status),
    deliveryFee: toNumber(delivery.deliveryFee ?? order.deliveryFee ?? note.deliveryFee, 0),
    address: String(delivery.address || order.address || note.address || ''),
    city: String(delivery.city || order.city || note.city || ''),
  };
}

function normalizeDeliveryNote(note, settings = {}) {
  const lines = Array.isArray(note.lines)
    ? note.lines.map(normalizeLine)
    : Array.isArray(note.lineItems)
      ? note.lineItems.map(normalizeLine)
      : [];
  const customer = note.customer && typeof note.customer === 'object'
    ? {
        id: String(note.customer.id || note.customerId || ''),
        name: String(note.customer.name || note.customerName || ''),
        phone: String(note.customer.phone || note.phone || ''),
        email: String(note.customer.email || note.email || ''),
        address: String(note.customer.address || note.address || ''),
        city: String(note.customer.city || note.city || ''),
        country: String(note.customer.country || note.country || ''),
      }
    : {
        id: String(note.customerId || ''),
        name: String(note.customerName || ''),
        phone: String(note.phone || ''),
        email: String(note.email || ''),
        address: String(note.address || ''),
        city: String(note.city || ''),
        country: String(note.country || ''),
      };
  const delivery = note.delivery && typeof note.delivery === 'object'
    ? normalizeDeliveryInfo({}, note.delivery, note)
    : normalizeDeliveryInfo({}, {}, note);

  return {
    ...note,
    id: String(note.id || createId('dn')),
    number: String(note.number || `BL-${Date.now().toString().slice(-8)}`),
    orderId: String(note.orderId || ''),
    invoiceId: String(note.invoiceId || ''),
    deliveryId: delivery.id,
    customerId: customer.id,
    customerName: customer.name,
    customer,
    business: note.business && typeof note.business === 'object' ? note.business : normalizeBusiness(settings),
    lines,
    lineItems: lines,
    delivery,
    deliveryCompany: delivery.company,
    driverName: delivery.driverName,
    trackingNumber: delivery.trackingNumber,
    deliveryStatus: delivery.status,
    status: delivery.status,
    createdAt: note.createdAt || now(),
    updatedAt: note.updatedAt || note.createdAt || now(),
  };
}

export function createDeliveryNoteService({ deliveryNotesRepo, settingsRepo, ecommerceService, deliveriesRepo, invoicesRepo, auditLogService, pdfGenerationService }) {
  async function getSettings() {
    return settingsRepo?.getAll ? settingsRepo.getAll() : {};
  }

  async function nextDeliveryNoteNumber() {
    const year = new Date().getFullYear();
    const rows = await deliveryNotesRepo.list();
    const maxSequence = rows
      .filter((row) => String(row.number || '').startsWith(`BL-${year}-`))
      .reduce((max, row) => Math.max(max, toDeliveryNoteSequence(row.number)), 0);
    return `BL-${year}-${String(maxSequence + 1).padStart(4, '0')}`;
  }

  async function findDeliveryForOrder(order) {
    if (order.deliveryId) {
      const byId = await deliveriesRepo.getById(order.deliveryId);
      if (byId) return byId;
    }
    const rows = await deliveriesRepo.list();
    return rows.find((delivery) => String(delivery.orderId || '') === String(order.id)) || null;
  }

  async function findInvoiceForOrder(orderId) {
    const rows = await invoicesRepo.list();
    return rows
      .filter((invoice) => String(invoice.orderId || '') === String(orderId))
      .sort((left, right) => String(right.createdAt || right.issueDate || '').localeCompare(String(left.createdAt || left.issueDate || '')))[0] || null;
  }

  async function listDeliveryNotes(filters = {}) {
    const settings = await getSettings();
    let rows = (await deliveryNotesRepo.list()).map((note) => normalizeDeliveryNote(note, settings));
    if (filters.status) rows = rows.filter((note) => note.deliveryStatus === filters.status || note.status === filters.status);
    if (filters.customer) {
      const query = String(filters.customer).toLowerCase();
      rows = rows.filter((note) =>
        [note.customer?.name, note.customer?.phone, note.customer?.city, note.customerName, note.customerId].some((value) =>
          String(value || '').toLowerCase().includes(query)
        )
      );
    }
    if (filters.orderId) rows = rows.filter((note) => String(note.orderId || '') === String(filters.orderId));
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom).getTime();
      if (Number.isFinite(from)) rows = rows.filter((note) => new Date(note.createdAt).getTime() >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo).getTime() + 86_399_999;
      if (Number.isFinite(to)) rows = rows.filter((note) => new Date(note.createdAt).getTime() <= to);
    }
    return rows.sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  }

  async function getDeliveryNote(id) {
    const row = await deliveryNotesRepo.getById(id);
    if (!row) return null;
    return normalizeDeliveryNote(row, await getSettings());
  }

  async function updateDeliveryNote(context, id, patch = {}) {
    const current = await getDeliveryNote(id);
    if (!current) throw new AppError(404, 'NOT_FOUND', 'Delivery note not found');
    const settings = await getSettings();
    const deliveryPatch = patch.delivery && typeof patch.delivery === 'object' ? patch.delivery : {};
    const next = normalizeDeliveryNote(
      {
        ...current,
        ...patch,
        delivery: {
          ...(current.delivery || {}),
          ...deliveryPatch,
          status: patch.status || patch.deliveryStatus || deliveryPatch.status || current.deliveryStatus,
        },
        updatedAt: now(),
      },
      settings
    );
    const updated = await deliveryNotesRepo.update(id, next);
    await auditLogService.record(context, 'delivery_notes.update', 'delivery_note', id, patch);
    return normalizeDeliveryNote(updated, settings);
  }

  async function generateFromOrder(context, orderId) {
    const order = await ecommerceService.getOrder(orderId);
    if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');
    if (!order.lineItems?.length) throw new AppError(400, 'VALIDATION_ERROR', 'Order has no product lines');

    const [settings, delivery, invoice] = await Promise.all([
      getSettings(),
      findDeliveryForOrder(order),
      findInvoiceForOrder(order.id),
    ]);
    const timestamp = now();
    const deliveryInfo = normalizeDeliveryInfo(order, delivery || {}, {});
    const note = normalizeDeliveryNote(
      {
        id: createId('dn'),
        number: await nextDeliveryNoteNumber(),
        orderId: order.id,
        invoiceId: invoice?.id || '',
        deliveryId: deliveryInfo.id,
        customer: normalizeCustomerFromOrder(order),
        business: normalizeBusiness(settings),
        lines: order.lineItems.map(normalizeLine),
        delivery: deliveryInfo,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      settings
    );
    const created = await deliveryNotesRepo.create(note);
    await auditLogService.record(context, 'delivery_notes.generate', 'delivery_note', created.id, {
      orderId: order.id,
      deliveryId: created.deliveryId,
      invoiceId: created.invoiceId,
      number: created.number,
    });
    return created;
  }

  async function createPdf(context, id) {
    const note = await getDeliveryNote(id);
    if (!note) throw new AppError(404, 'NOT_FOUND', 'Delivery note not found');
    const pdf = pdfGenerationService.createDeliveryNotePdf(note);
    await auditLogService.record(context, 'delivery_notes.download_pdf', 'delivery_note', id, { number: note.number });
    return pdf;
  }

  async function deleteDeliveryNote(context, id) {
    const note = await getDeliveryNote(id);
    if (!note) throw new AppError(404, 'NOT_FOUND', 'Delivery note not found');
    const deleted = await deliveryNotesRepo.remove(id);
    await auditLogService.record(context, 'delivery_notes.delete', 'delivery_note', id, {
      number: note.number,
      orderId: note.orderId,
    });
    return normalizeDeliveryNote(deleted, await getSettings());
  }

  return {
    listDeliveryNotes,
    getDeliveryNote,
    updateDeliveryNote,
    generateFromOrder,
    createPdf,
    deleteDeliveryNote,
  };
}
