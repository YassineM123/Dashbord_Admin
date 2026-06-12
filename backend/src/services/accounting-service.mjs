import { AppError } from '../core/errors.mjs';

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

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function dayKey(value) {
  const date = new Date(value || now());
  return Number.isNaN(date.getTime()) ? now().slice(0, 10) : date.toISOString().slice(0, 10);
}

function monthKey(value) {
  return dayKey(value).slice(0, 7);
}

function isFinalSale(order) {
  return !['Cancelled', 'Returned'].includes(String(order.status || ''));
}

function normalizeExpense(expense = {}) {
  const title = String(expense.title || expense.label || 'Expense').trim();
  const category = String(expense.category || 'General').trim();
  const note = String(expense.note || expense.notes || '').trim();
  return {
    ...expense,
    id: String(expense.id || createId('exp')),
    title,
    label: title,
    category,
    amount: roundMoney(expense.amount),
    date: expense.date || now(),
    paymentMethod: String(expense.paymentMethod || expense.payment || 'Cash').trim(),
    note,
    notes: note,
    createdAt: expense.createdAt || expense.date || now(),
    updatedAt: expense.updatedAt || expense.createdAt || expense.date || now(),
  };
}

function orderRevenue(order) {
  return toNumber(order.total ?? order.amount, 0);
}

function orderProductCost(order) {
  return (order.lineItems || []).reduce((sum, item) => sum + toNumber(item.costPrice, 0) * toNumber(item.quantity, 0), 0);
}

function buildBestProfitProducts(orders) {
  const byProduct = new Map();
  orders.filter(isFinalSale).forEach((order) => {
    (order.lineItems || []).forEach((item) => {
      const key = String(item.productId || item.sku || item.name);
      const current = byProduct.get(key) || {
        productId: String(item.productId || ''),
        name: String(item.name || 'Product'),
        sku: String(item.sku || ''),
        quantity: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        margin: 0,
      };
      const revenue = toNumber(item.total, toNumber(item.unitPrice, 0) * toNumber(item.quantity, 0));
      const cost = toNumber(item.costPrice, 0) * toNumber(item.quantity, 0);
      current.quantity += toNumber(item.quantity, 0);
      current.revenue += revenue;
      current.cost += cost;
      current.profit += revenue - cost;
      current.margin = current.revenue > 0 ? roundMoney((current.profit / current.revenue) * 100) : 0;
      byProduct.set(key, current);
    });
  });
  return [...byProduct.values()]
    .map((row) => ({
      ...row,
      revenue: roundMoney(row.revenue),
      cost: roundMoney(row.cost),
      profit: roundMoney(row.profit),
    }))
    .sort((left, right) => right.profit - left.profit)
    .slice(0, 5);
}

function expenseMatchesAdSpend(expense) {
  return /(ads?|advertising|marketing|meta|google|publicit)/i.test(`${expense.category} ${expense.title}`);
}

export function createAccountingService({ ecommerceService, expensesRepo, adCampaignsRepo, invoicesRepo, auditLogService }) {
  async function listExpenses(filters = {}) {
    let rows = (await expensesRepo.list()).map(normalizeExpense);
    if (filters.category && filters.category !== 'all') rows = rows.filter((expense) => expense.category === filters.category);
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom).getTime();
      if (Number.isFinite(from)) rows = rows.filter((expense) => new Date(expense.date).getTime() >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo).getTime() + 86_399_999;
      if (Number.isFinite(to)) rows = rows.filter((expense) => new Date(expense.date).getTime() <= to);
    }
    return rows.sort((left, right) => String(right.date).localeCompare(String(left.date)));
  }

  async function createExpense(context, payload = {}) {
    const title = String(payload.title || payload.label || '').trim();
    if (!title) {
      throw new AppError(400, 'VALIDATION_ERROR', 'title is required');
    }
    const amount = toNumber(payload.amount, NaN);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'amount must be greater than zero');
    }
    const expense = await expensesRepo.create(normalizeExpense({
      ...payload,
      id: payload.id || createId('exp'),
      amount,
      date: payload.date || now(),
    }));
    await auditLogService.record(context, 'expenses.create', 'expense', expense.id, expense);
    return expense;
  }

  async function updateExpense(context, id, patch = {}) {
    const current = await expensesRepo.getById(id);
    if (!current) throw new AppError(404, 'NOT_FOUND', 'Expense not found');
    const next = normalizeExpense({
      ...current,
      ...patch,
      updatedAt: now(),
    });
    if (!next.title) {
      throw new AppError(400, 'VALIDATION_ERROR', 'title is required');
    }
    if (!Number.isFinite(next.amount) || next.amount <= 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'amount must be greater than zero');
    }
    const updated = await expensesRepo.update(id, next);
    await auditLogService.record(context, 'expenses.update', 'expense', id, patch);
    return normalizeExpense(updated);
  }

  async function deleteExpense(context, id) {
    const current = await expensesRepo.getById(id);
    if (!current) throw new AppError(404, 'NOT_FOUND', 'Expense not found');
    const deleted = await expensesRepo.remove(id);
    await auditLogService.record(context, 'expenses.delete', 'expense', id, {
      title: current.title || current.label,
      amount: current.amount,
    });
    return normalizeExpense(deleted);
  }

  async function dashboard() {
    const [orders, products, expenses, adCampaigns] = await Promise.all([
      ecommerceService.listOrders(),
      ecommerceService.listProducts(),
      listExpenses(),
      adCampaignsRepo.list(),
    ]);
    const validOrders = orders.filter(isFinalSale);
    const revenue = validOrders.reduce((sum, order) => sum + orderRevenue(order), 0);
    const productCost = validOrders.reduce((sum, order) => sum + orderProductCost(order), 0);
    const deliveryFees = validOrders.reduce((sum, order) => sum + toNumber(order.deliveryFee, 0), 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + toNumber(expense.amount, 0), 0);
    const adSpendFromExpenses = expenses.filter(expenseMatchesAdSpend).reduce((sum, expense) => sum + toNumber(expense.amount, 0), 0);
    const plannedAdBudget = adCampaigns.reduce((sum, campaign) => sum + toNumber(campaign.budget, 0), 0);
    const grossProfit = revenue - productCost;
    const estimatedProfit = grossProfit - totalExpenses;
    const byDay = new Map();
    const byMonth = new Map();

    validOrders.forEach((order) => {
      const day = dayKey(order.date || order.createdAt);
      const month = monthKey(order.date || order.createdAt);
      const currentDay = byDay.get(day) || { date: day, revenue: 0, orders: 0 };
      currentDay.revenue += orderRevenue(order);
      currentDay.orders += 1;
      byDay.set(day, currentDay);

      const currentMonth = byMonth.get(month) || { month, revenue: 0, productCost: 0, expenses: 0, profit: 0 };
      currentMonth.revenue += orderRevenue(order);
      currentMonth.productCost += orderProductCost(order);
      byMonth.set(month, currentMonth);
    });

    expenses.forEach((expense) => {
      const month = monthKey(expense.date);
      const currentMonth = byMonth.get(month) || { month, revenue: 0, productCost: 0, expenses: 0, profit: 0 };
      currentMonth.expenses += toNumber(expense.amount, 0);
      byMonth.set(month, currentMonth);
    });

    const monthlyProfit = [...byMonth.values()]
      .map((row) => ({
        month: row.month,
        revenue: roundMoney(row.revenue),
        productCost: roundMoney(row.productCost),
        expenses: roundMoney(row.expenses),
        profit: roundMoney(row.revenue - row.productCost - row.expenses),
      }))
      .sort((left, right) => left.month.localeCompare(right.month));

    return {
      currency: 'TND',
      totalRevenue: roundMoney(revenue),
      revenue: roundMoney(revenue),
      totalExpenses: roundMoney(totalExpenses),
      expenses: roundMoney(totalExpenses),
      productCost: roundMoney(productCost),
      grossProfit: roundMoney(grossProfit),
      grossMargin: revenue > 0 ? roundMoney((grossProfit / revenue) * 100) : 0,
      deliveryFees: roundMoney(deliveryFees),
      adSpend: roundMoney(adSpendFromExpenses),
      plannedAdBudget: roundMoney(plannedAdBudget),
      estimatedProfit: roundMoney(estimatedProfit),
      profit: roundMoney(estimatedProfit),
      monthlyProfit,
      dailyRevenue: [...byDay.values()]
        .map((row) => ({ ...row, revenue: roundMoney(row.revenue) }))
        .sort((left, right) => left.date.localeCompare(right.date)),
      bestProfitProducts: buildBestProfitProducts(validOrders),
      expensesList: expenses,
      expenseCategories: [...new Set(expenses.map((expense) => expense.category))].sort(),
      productsWithCost: products.map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        price: product.price,
        costPrice: product.costPrice,
        grossProfit: roundMoney(toNumber(product.price, 0) - toNumber(product.costPrice, 0)),
        grossMargin: toNumber(product.price, 0) > 0 ? roundMoney(((toNumber(product.price, 0) - toNumber(product.costPrice, 0)) / toNumber(product.price, 0)) * 100) : 0,
      })),
    };
  }

  async function summary() {
    const [data, invoices] = await Promise.all([dashboard(), invoicesRepo.list()]);
    return {
      revenue: data.totalRevenue,
      cost: data.productCost,
      expenses: data.totalExpenses,
      grossMargin: data.grossProfit,
      profit: data.estimatedProfit,
      invoicesCount: invoices.length,
      paymentTracking: invoices.reduce((acc, invoice) => {
        const status = String(invoice.paymentStatus || 'Unpaid');
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {}),
      deliveryFees: data.deliveryFees,
      adSpend: data.adSpend,
      grossMarginRate: data.grossMargin,
    };
  }

  async function exportCsv(context) {
    const data = await dashboard();
    const lines = [
      'section,metric,value',
      ['summary', 'totalRevenue', data.totalRevenue].map(csvCell).join(','),
      ['summary', 'totalExpenses', data.totalExpenses].map(csvCell).join(','),
      ['summary', 'productCost', data.productCost].map(csvCell).join(','),
      ['summary', 'grossProfit', data.grossProfit].map(csvCell).join(','),
      ['summary', 'grossMarginPercent', data.grossMargin].map(csvCell).join(','),
      ['summary', 'deliveryFees', data.deliveryFees].map(csvCell).join(','),
      ['summary', 'adSpend', data.adSpend].map(csvCell).join(','),
      ['summary', 'estimatedProfit', data.estimatedProfit].map(csvCell).join(','),
      '',
      'expenseId,title,category,amount,date,paymentMethod,note',
      ...data.expensesList.map((expense) =>
        [expense.id, expense.title, expense.category, expense.amount, expense.date, expense.paymentMethod, expense.note].map(csvCell).join(',')
      ),
      '',
      'productId,name,sku,quantity,revenue,cost,profit,margin',
      ...data.bestProfitProducts.map((product) =>
        [product.productId, product.name, product.sku, product.quantity, product.revenue, product.cost, product.profit, product.margin].map(csvCell).join(',')
      ),
      '',
      'month,revenue,productCost,expenses,profit',
      ...data.monthlyProfit.map((row) => [row.month, row.revenue, row.productCost, row.expenses, row.profit].map(csvCell).join(',')),
    ];
    await auditLogService.record(context, 'accounting.export_csv', 'accounting', 'csv', { expenses: data.expensesList.length });
    return lines.join('\n');
  }

  return {
    dashboard,
    summary,
    listExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
    exportCsv,
  };
}
