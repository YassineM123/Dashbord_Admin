import { requireAuth } from '../middleware/auth.mjs';

function normalize(value) {
  return String(value || '').toLowerCase();
}

export function registerSearchRoutes(router, deps) {
  const { ordersRepo, productsRepo, customersRepo, leadsRepo } = deps;

  router.register('GET', '/api/search', async (context) => {
    await requireAuth(context);
    const q = String(context.query.q || '').trim().toLowerCase();
    if (!q || q.length < 2) {
      return {
        status: 200,
        data: [],
        meta: { total: 0 },
      };
    }

    const [orders, products, customers, leads] = await Promise.all([
      ordersRepo.list(),
      productsRepo.list(),
      customersRepo.list(),
      leadsRepo.list(),
    ]);

    const results = [];

    for (const order of orders) {
      if (normalize(order.id).includes(q) || normalize(order.customer).includes(q) || normalize(order.customerName).includes(q)) {
        results.push({
          id: `order:${order.id}`,
          type: 'order',
          title: `Commande ${order.id}`,
          subtitle: `Client: ${order.customer || order.customerName || ''}`,
          path: '/admin/orders',
        });
      }
    }

    for (const product of products) {
      if (normalize(product.name).includes(q) || normalize(product.category).includes(q)) {
        results.push({
          id: `product:${product.id}`,
          type: 'product',
          title: product.name,
          subtitle: `Prix: ${product.price} TND`,
          path: '/admin/products',
        });
      }
    }

    for (const customer of customers) {
      if (normalize(customer.name).includes(q) || normalize(customer.email).includes(q)) {
        results.push({
          id: `customer:${customer.id}`,
          type: 'customer',
          title: customer.name,
          subtitle: customer.email,
          path: '/admin/customers',
        });
      }
    }

    for (const lead of leads) {
      if (normalize(lead.name).includes(q) || normalize(lead.city).includes(q)) {
        results.push({
          id: `lead:${lead.id}`,
          type: 'lead',
          title: lead.name,
          subtitle: `Ville: ${lead.city}`,
          path: '/admin/leads',
        });
      }
    }

    return {
      status: 200,
      data: results.slice(0, 20),
      meta: { total: results.length },
    };
  });
}
