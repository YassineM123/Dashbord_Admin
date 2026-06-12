import { createArrayRepository } from './resource-repo.mjs';

export function createInvoiceRepository(store) {
  const repo = createArrayRepository(store, 'invoices');

  async function findByNumber(number) {
    const rows = await repo.list();
    return rows.find((invoice) => String(invoice.number || '') === String(number || '')) || null;
  }

  return {
    ...repo,
    findByNumber,
  };
}
