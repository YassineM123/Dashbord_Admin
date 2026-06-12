import assert from 'node:assert/strict';
import { createSocialAgentService } from '../src/services/social-agent-service.mjs';

function createService(products = []) {
  return createSocialAgentService({
    env: {},
    dataAccess: {
      productsRepo: {
        list: async () => products,
      },
      settingsRepo: {
        getAll: async () => ({
          store: { name: 'Dashbird Store' },
          payments: { currency: 'TND' },
        }),
      },
    },
  });
}

function assertStructuredReplyShape(payload) {
  const required = ['language', 'intent', 'sentiment', 'confidence', 'reply', 'needs_human', 'human_reason', 'suggested_action'];
  for (const key of required) {
    assert.ok(Object.prototype.hasOwnProperty.call(payload, key), `Missing key "${key}" in social reply`);
  }
  assert.equal(typeof payload.language, 'string');
  assert.equal(typeof payload.intent, 'string');
  assert.equal(typeof payload.sentiment, 'string');
  assert.equal(typeof payload.reply, 'string');
  assert.equal(typeof payload.needs_human, 'boolean');
  assert.equal(typeof payload.human_reason, 'string');
  assert.equal(typeof payload.suggested_action, 'string');
  assert.equal(typeof payload.confidence, 'number');
  assert.ok(payload.confidence >= 0 && payload.confidence <= 1, 'confidence must be between 0 and 1');
}

async function run() {
  const service = createService([
    { id: 'p1', name: 'Sac Sport Pro', price: 89.9, stock: 12, status: 'active', category: 'bags', views: 120 },
    { id: 'p2', name: 'Basket Air Max', price: 199, stock: 5, status: 'active', category: 'shoes', views: 300 },
  ]);

  const intentCases = [
    { message: 'Je veux commander ce produit', intent: 'order' },
    { message: 'Donnez moi les details du produit Sac Sport Pro', intent: 'product_question' },
    { message: '9adeh soum ?', intent: 'price_question' },
    { message: 'Est-il disponible maintenant ?', intent: 'availability' },
    { message: 'Livraison a Sfax ?', intent: 'delivery' },
    { message: 'Wrong product and late delivery', intent: 'complaint' },
    { message: 'Besoin aide SAV', intent: 'support' },
    { message: 'just looking for now', intent: 'lead' },
    { message: 'https://bit.ly/promo', intent: 'spam' },
    { message: 'ok', intent: 'unknown' },
  ];

  for (const row of intentCases) {
    const payload = await service.replyToCustomer({
      message: row.message,
      channel: 'whatsapp',
      contact: 'Client Test',
      history: [{ sender: 'contact', text: row.message }],
    });
    assertStructuredReplyShape(payload);
    assert.equal(payload.intent, row.intent, `Intent mismatch for message "${row.message}"`);
  }

  const dialectPayload = await service.replyToCustomer({
    message: 'nheb naaref 9adeh soum w fama livraison',
    channel: 'whatsapp',
    contact: 'Client Test',
    history: [{ sender: 'contact', text: 'nheb naaref 9adeh soum w fama livraison' }],
  });
  assert.equal(dialectPayload.language, 'ar');
  assert.equal(dialectPayload.language_variant, 'tunisian_dialect');

  const frPayload = await service.replyToCustomer({
    message: 'Bonjour, quel est le prix ?',
    channel: 'whatsapp',
    contact: 'Client Test',
    history: [{ sender: 'contact', text: 'Bonjour, quel est le prix ?' }],
  });
  assert.equal(frPayload.language, 'fr');

  const enPayload = await service.replyToCustomer({
    message: 'Hello, what is your delivery policy?',
    channel: 'whatsapp',
    contact: 'Client Test',
    history: [{ sender: 'contact', text: 'Hello, what is your delivery policy?' }],
  });
  assert.equal(enPayload.language, 'en');

  const complaintEscalation = await service.replyToCustomer({
    message: 'I am very angry, wrong product and bad service',
    channel: 'whatsapp',
    contact: 'Client Test',
    history: [{ sender: 'contact', text: 'I am very angry, wrong product and bad service' }],
  });
  assert.equal(complaintEscalation.needs_human, true);
  assert.equal(complaintEscalation.suggested_action, 'escalate');

  const refundEscalation = await service.replyToCustomer({
    message: 'I need refund immediately',
    channel: 'whatsapp',
    contact: 'Client Test',
    history: [{ sender: 'contact', text: 'I need refund immediately' }],
  });
  assert.equal(refundEscalation.needs_human, true);
  assert.equal(refundEscalation.suggested_action, 'escalate');

  const lowConfidenceEscalation = await service.replyToCustomer({
    message: '.... ???',
    channel: 'whatsapp',
    contact: 'Client Test',
    history: [{ sender: 'contact', text: '.... ???' }],
  });
  assert.equal(lowConfidenceEscalation.needs_human, true);
  assert.equal(lowConfidenceEscalation.suggested_action, 'escalate');

  const greetingNoEscalation = await service.replyToCustomer({
    message: 'bonjour',
    channel: 'whatsapp',
    contact: 'Client Test',
    history: [{ sender: 'contact', text: 'bonjour' }],
  });
  assert.equal(greetingNoEscalation.needs_human, false);

  const extractedOrder = await service.extractOrderInformation({
    conversationHistory: [
      { sender: 'contact', text: 'Je veux commander Basket Air Max' },
      { sender: 'contact', text: 'Nom: Ahmed Ben Ali' },
      { sender: 'contact', text: 'Tel: 20123456' },
      { sender: 'contact', text: 'Quantite: 2' },
      { sender: 'contact', text: 'Adresse: Rue Habib Bourguiba, Sfax' },
      { sender: 'contact', text: 'Note: Appeler avant livraison' },
    ],
  });

  const orderKeys = ['status', 'customer_name', 'phone', 'product', 'variant', 'quantity', 'address', 'city', 'notes', 'confidence'];
  for (const key of orderKeys) {
    assert.ok(Object.prototype.hasOwnProperty.call(extractedOrder, key), `Missing key "${key}" in order extraction`);
  }
  assert.ok(['confirmed', 'not_confirmed', 'needs_review'].includes(extractedOrder.status));
  assert.equal(typeof extractedOrder.customer_name, 'string');
  assert.equal(typeof extractedOrder.phone, 'string');
  assert.equal(typeof extractedOrder.product, 'string');
  assert.equal(typeof extractedOrder.quantity, 'number');
  assert.equal(typeof extractedOrder.address, 'string');
  assert.equal(typeof extractedOrder.city, 'string');
  assert.equal(typeof extractedOrder.notes, 'string');
  assert.equal(typeof extractedOrder.confidence, 'number');
  assert.ok(extractedOrder.confidence >= 0 && extractedOrder.confidence <= 1);

  console.log('Social agent regression checks passed.');
}

run().catch((error) => {
  console.error('Social agent regression checks failed.');
  console.error(error);
  process.exit(1);
});

