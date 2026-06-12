import { toast } from 'sonner';

export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError extends Error {
  status?: number;
  code?: string;
  path?: string;
  method?: string;
  raw?: unknown;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  active?: boolean;
  avatar?: string;
  tokenId?: string | null;
  tokenExpiresAt?: number;
}

export interface AuthSession {
  token: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
  expiresAt: string;
  refreshExpiresAt: string;
  user: AuthUser;
}

export interface OrderRecord {
  id: string;
  customer: string;
  email: string;
  status: string;
  payment: string;
  delivery: string;
  amount: number;
  date: string;
  customerId?: string;
  phone?: string;
  country?: string;
  source?: string;
  customerSource?: string;
  customerNote?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  deliveryStatus?: string;
  deliveryType?: string;
  deliveryCompanyName?: string;
  driverName?: string;
  driverPhone?: string;
  trackingNumber?: string;
  deliveryId?: string;
  deliveryFee?: number;
  discount?: number;
  subtotal?: number;
  total?: number;
  lineItems?: OrderLineItem[];
  internalNotes?: Array<{ id: string; text: string; createdAt: string; createdBy?: string }>;
  internalNote?: string;
  timeline?: Array<{ id: string; type?: string; label?: string; status?: string; timestamp: string; userId?: string }>;
  city?: string;
  address?: string;
  courier?: string;
  tracking?: string;
  eta?: string;
  deliveryNotes?: string;
  deliveryUpdatedAt?: string;
}

export interface OrderLineItem {
  id: string;
  productId: string;
  variantId?: string;
  name: string;
  sku?: string;
  size?: string;
  color?: string;
  material?: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
  total: number;
}

export interface ProductVariantRecord {
  id: string;
  size: string;
  color: string;
  material?: string;
  sku: string;
  stock: number;
  reserved: number;
  lowStockThreshold: number;
}

export interface ProductRecord {
  id: string;
  name: string;
  sku?: string;
  price: number;
  costPrice?: number;
  stock: number;
  views: number;
  status: string;
  category: string;
  active?: boolean;
  updated: string;
  image: string;
  variants?: ProductVariantRecord[];
}

export interface CustomerRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  orders: number;
  totalSpent: number;
  lastActivity: string;
  address?: string;
  city?: string;
  country?: string;
  tags?: string[];
  notes?: Array<{ id: string; text: string; createdAt: string; createdBy?: string }>;
  reminders?: Array<{ id: string; title: string; dueAt: string; status: string; createdAt: string }>;
  segment?: 'New' | 'VIP' | 'Repeat Buyer' | 'Inactive' | string;
  orderHistory?: OrderRecord[];
  lastOrderDate?: string;
}

export type AIOrderStatus = 'brouillon' | 'confirme' | 'annule';

export interface AIOrderRecord {
  id: string;
  source: string;
  customer: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  product: string;
  productDescription?: string;
  status: AIOrderStatus;
  amount: number;
  date: string;
  confidence: number;
}

export type LeadStatus = 'nouveau' | 'contacte' | 'converti';

export interface LeadRecord {
  id: string;
  name: string;
  category: string;
  phone: string;
  city: string;
  source: string;
  status: LeadStatus;
  email?: string;
  address?: string;
  notes?: string;
}

export interface ScrapeJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  query: string;
  category: string;
  city: string;
  limit: number;
  startedAt: string;
  completedAt?: string | null;
  createdCount?: number;
}

export type Channel = 'facebook' | 'instagram' | 'whatsapp' | 'manual';

export interface ConversationRecord {
  id: string;
  channel: Channel;
  contact: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
  avatar: string;
}

export interface MessageRecord {
  id: string;
  sender: 'user' | 'contact';
  text: string;
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read';
  aiMeta?: Record<string, unknown>;
}

export type DashboardAssistantRole = 'user' | 'assistant';
export type DashboardAssistantLanguage = 'en' | 'fr' | 'ar';
export type DashboardAssistantMode = 'assistant' | 'agent';

export interface DashboardAssistantTurn {
  role: DashboardAssistantRole;
  content: string;
}

export interface DashboardAssistantResponse {
  reply: string;
  suggestions: string[];
  mode: 'ai' | 'fallback';
  language: DashboardAssistantLanguage;
  assistantMode: DashboardAssistantMode;
  accessScope?: {
    level: string;
    modules: string[];
    records: Record<string, number>;
  };
  timestamp: string;
}

export interface AgentsSettings {
  autoReplyEnabled: boolean;
  tone: 'professionnel' | 'amical' | 'commercial';
  language: 'fr' | 'en' | 'ar';
}

export interface AgentRule {
  id: string;
  contains: string;
  action: string;
  active: boolean;
  triggers: number;
}

export interface SocialAgentAnalysis {
  language: 'fr' | 'ar' | 'en';
  language_variant?: 'standard' | 'tunisian_dialect';
  intent:
    | 'order'
    | 'product_question'
    | 'price_question'
    | 'availability'
    | 'delivery'
    | 'complaint'
    | 'support'
    | 'lead'
    | 'spam'
    | 'unknown';
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
  reply: string;
  cta: string;
  needs_human: boolean;
  human_reason: string;
  suggested_action:
    | 'create_order'
    | 'collect_customer_info'
    | 'share_product_info'
    | 'offer_alternative'
    | 'escalate'
    | 'ask_clarification';
  missing_fields?: Array<'product' | 'quantity' | 'full_name' | 'phone' | 'address'>;
  ready_to_create_order?: boolean;
}

export interface SocialMessageAnalysis {
  language: 'fr' | 'ar' | 'en';
  language_variant?: 'standard' | 'tunisian_dialect';
  intent:
    | 'order'
    | 'product_question'
    | 'price_question'
    | 'availability'
    | 'delivery'
    | 'complaint'
    | 'support'
    | 'lead'
    | 'spam'
    | 'unknown';
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
  needs_human: boolean;
  reason: string;
}

export interface AgentSuggestionResponse {
  conversationId: string;
  text: string;
  analysis?: SocialAgentAnalysis | null;
}

export interface ExtractedOrderInfo {
  status: 'confirmed' | 'not_confirmed' | 'needs_review';
  customer_name: string;
  phone: string;
  product: string;
  variant: string;
  quantity: number;
  address: string;
  city: string;
  notes: string;
  confidence: number;
}

export interface CopilotAction {
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  link?: string;
}

export interface CopilotAnomaly {
  severity: string;
  title: string;
  description: string;
}

export interface CopilotAnalysis {
  answer: string;
  findings: string[];
  anomalies: CopilotAnomaly[];
  actions: CopilotAction[];
  dataGaps: string[];
  metadata?: {
    executionTimeMs: number;
    model: string;
    generatedAt: string;
  };
}

export interface AdvancedCopilotAnalysis {
  mainAnalysis: string;
  keyInsights: Array<{ title: string; description: string; impact: 'high' | 'medium' | 'low' | string }>;
  anomalies: Array<{ title: string; description: string; severity: string; action: string }>;
  priorityActions: Array<{ title: string; description: string; link: string; priority: 'high' | 'medium' | 'low' | string }>;
  invoiceCheck: {
    totalInvoices: number;
    verifiedInvoices: number;
    pendingInvoices: number;
    issues: string[];
  };
  factsVsHypothesis: Array<{ statement: string; type: 'fact' | 'hypothesis' | string; confidence: number; source: string }>;
  metadata: {
    executionTime: string;
    dataPoints?: string;
    modelsUsed: string[];
    confidence?: number;
    lastUpdate: string;
  };
}

export interface AdminUserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
}

export interface NotificationRecord {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  time: string;
  createdAt?: string;
  read: boolean;
  priority?: 'low' | 'medium' | 'high';
  link?: string;
  entityType?: string;
  entityId?: string;
  dedupeKey?: string;
}

export interface GlobalSearchResult {
  id: string;
  type: 'order' | 'product' | 'customer' | 'lead' | string;
  title: string;
  subtitle: string;
  path: string;
}

export interface AppSettings {
  store: {
    name: string;
    supportEmail: string;
    supportPhone: string;
    address: string;
  };
  payments: {
    cardEnabled: boolean;
    codEnabled: boolean;
    bankTransferEnabled: boolean;
    currency: string;
  };
  notifications: {
    newOrders: boolean;
    lowStock: boolean;
    campaignReports: boolean;
    executiveSummaryEnabled: boolean;
    executiveSummaryFrequency: string;
  };
  security: {
    sessionDuration: string;
  };
  integrations?: {
    ga4?: {
      connected: boolean;
      measurementId: string;
      placeholder: boolean;
    };
  };
  agents: AgentsSettings;
  agentRules: AgentRule[];
}

export interface StockMovementRecord {
  id: string;
  type: string;
  productId: string;
  variantId?: string;
  quantity: number;
  reason: string;
  orderId?: string;
  createdAt: string;
  createdBy?: string;
}

export interface StockAlertRecord {
  id: string;
  productId: string;
  productName: string;
  variantId: string;
  size: string;
  color: string;
  material?: string;
  stock: number;
  threshold: number;
  type: 'low_stock' | 'out_of_stock';
}

export interface IntegrationField {
  key: string;
  label: string;
  type: string;
  secret: boolean;
}

export interface IntegrationRecord {
  id: string;
  name: string;
  category: string;
  status: 'connected' | 'disconnected' | 'error' | string;
  connected: boolean;
  lastSync: string;
  lastTestAt: string;
  message: string;
  fields: IntegrationField[];
  config: Record<string, string>;
  secrets: Record<string, { hasValue: boolean; maskedValue: string; source: string }>;
  envConfigured: boolean;
}

export interface IntegrationsHealth {
  ok: boolean;
  total: number;
  connected: number;
  failed: number;
  checkedAt: string;
  integrations: Array<Pick<IntegrationRecord, 'id' | 'name' | 'status' | 'connected' | 'envConfigured' | 'lastSync' | 'lastTestAt' | 'message'>>;
}

export interface DeliveryRecord {
  id: string;
  orderId: string;
  customerId?: string;
  deliveryType?: string;
  company: string;
  driverName: string;
  driverPhone: string;
  trackingNumber: string;
  deliveryFee: number;
  address: string;
  city: string;
  status: string;
  failedReason?: string;
  timeline?: Array<{ id: string; status: string; timestamp: string; userId?: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface InvoicePartyRecord {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  taxId?: string;
}

export interface InvoiceLineRecord {
  id: string;
  productId?: string;
  variantId?: string;
  name: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  discountRate: number;
  discountAmount: number;
  total: number;
}

export interface InvoiceRecord {
  id: string;
  number: string;
  orderId: string;
  customerId?: string;
  customerName?: string;
  business?: InvoicePartyRecord;
  customer?: InvoicePartyRecord;
  lines: InvoiceLineRecord[];
  currency: string;
  status: 'Draft' | 'Sent' | 'Paid' | 'Cancelled' | string;
  paymentStatus: 'Unpaid' | 'Paid' | 'Cash on Delivery' | 'Refunded' | string;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  deliveryFee: number;
  total: number;
  costTotal?: number;
  grossMargin?: number;
  issueDate: string;
  sentAt?: string;
  paidAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt?: string;
  sendPlaceholder?: {
    to: string;
    channel: string;
    message: string;
    sentAt: string;
    mode: string;
  } | null;
}

export interface InvoiceCreatePayload {
  orderId: string;
  taxRate?: number;
  discountRate?: number;
  deliveryFee?: number;
  status?: string;
  paymentStatus?: string;
}


export interface ManualOrderLineInput {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  size?: string;
  color?: string;
  material?: string;
}

export interface ManualOrderPayload {
  customer: {
    name: string;
    phone: string;
    email?: string;
    address: string;
    city: string;
    country: string;
    source: 'Facebook' | 'Instagram' | 'WhatsApp' | 'Phone' | 'Store' | 'Manual' | string;
    note?: string;
  };
  items: ManualOrderLineInput[];
  discount?: number;
  deliveryFee?: number;
  paymentMethod: 'Cash on delivery' | 'Paid online' | 'Bank transfer' | 'Other' | string;
  paymentStatus: 'Unpaid' | 'Paid' | 'Cash on Delivery' | string;
  status: 'New' | 'Confirmed' | 'Preparing' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Returned' | string;
  deliveryType?: 'Home delivery' | 'Pickup' | 'Delivery company' | string;
  deliveryCompanyName?: string;
  driverName?: string;
  driverPhone?: string;
  trackingNumber?: string;
  deliveryStatus?: 'Waiting' | 'Assigned' | 'Picked up' | 'On the way' | 'Delivered' | 'Failed' | 'Returned' | string;
  internalNote?: string;
}

export interface DeliveryNoteRecord {
  id: string;
  number: string;
  orderId: string;
  invoiceId?: string;
  deliveryId?: string;
  customerId?: string;
  customerName?: string;
  customer?: {
    id?: string;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    country?: string;
  };
  business?: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    taxId?: string;
  };
  delivery?: {
    id?: string;
    company?: string;
    driverName?: string;
    driverPhone?: string;
    trackingNumber?: string;
    status?: string;
    deliveryFee?: number;
    address?: string;
    city?: string;
  };
  status: string;
  deliveryStatus?: string;
  deliveryCompany?: string;
  driverName?: string;
  trackingNumber?: string;
  deliveryType?: string;
  lines?: Array<Pick<OrderLineItem, 'id' | 'productId' | 'variantId' | 'name' | 'sku' | 'size' | 'color' | 'material' | 'quantity'>>;
  lineItems?: OrderLineItem[];
  createdAt: string;
  updatedAt?: string;
}
export interface AccountingSummary {
  revenue: number;
  cost: number;
  expenses: number;
  grossMargin: number;
  profit: number;
  invoicesCount: number;
  paymentTracking: Record<string, number>;
  deliveryFees?: number;
  adSpend?: number;
  grossMarginRate?: number;
}

export interface ExpenseRecord {
  id: string;
  title: string;
  label?: string;
  category: string;
  amount: number;
  date: string;
  paymentMethod: string;
  note?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AccountingDashboard {
  currency: string;
  totalRevenue: number;
  revenue: number;
  totalExpenses: number;
  expenses: number;
  productCost: number;
  grossProfit: number;
  grossMargin: number;
  deliveryFees: number;
  adSpend: number;
  plannedAdBudget: number;
  estimatedProfit: number;
  profit: number;
  monthlyProfit: Array<{ month: string; revenue: number; productCost: number; expenses: number; profit: number }>;
  dailyRevenue: Array<{ date: string; revenue: number; orders: number }>;
  bestProfitProducts: Array<{ productId: string; name: string; sku: string; quantity: number; revenue: number; cost: number; profit: number; margin: number }>;
  expensesList: ExpenseRecord[];
  expenseCategories: string[];
  productsWithCost: Array<{ id: string; name: string; sku?: string; price: number; costPrice: number; grossProfit: number; grossMargin: number }>;
}

export interface MarketingCampaignRecord {
  id: string;
  name: string;
  channel: string;
  segment: string;
  subject: string;
  body: string;
  status: 'Draft' | 'Scheduled' | 'Sent';
  scheduledAt?: string;
  sentAt?: string;
  createdAt: string;
}

export interface MarketingTemplateRecord {
  id: string;
  name: string;
  channel: string;
  subject: string;
  body: string;
  placeholder?: boolean;
}

export interface AdCampaignRecord {
  id: string;
  name: string;
  platform: 'Meta' | 'Google' | 'Manual' | string;
  objective: string;
  status: string;
  budget: number;
  impressions: number;
  clicks: number;
  leads: number;
  orders: number;
  revenue: number;
  roas: number;
}

export interface SalesChannelRecord {
  id: string;
  provider: 'manual' | 'shopify' | 'woocommerce' | 'prestashop' | string;
  name: string;
  enabled: boolean;
  status: string;
  credentialsMeta: Record<string, unknown>;
  lastSyncAt?: string;
  productSyncEnabled: boolean;
  orderSyncEnabled: boolean;
  createdAt: string;
}

export interface SyncJobRecord {
  id: string;
  channelId: string;
  provider: string;
  type: 'products' | 'orders';
  status: string;
  startedAt: string;
  completedAt?: string;
  result?: Record<string, unknown>;
}

export interface AnalyticsOverview {
  kpis: {
    revenue: number;
    orders: number;
    customers: number;
    averageOrderValue: number;
    conversionRate: number | null;
  };
  revenueByDay: Array<{ date: string; revenue: number }>;
  ordersByStatus: Array<{ status: string; count: number }>;
  salesByCity: Array<{ city: string; revenue: number }>;
  bestSellingProducts: Array<{ productId: string; name: string; quantity: number; revenue: number }>;
  customerAcquisitionSource: Array<{ source: string; leads: number; orders: number }>;
  ga4: { connected: boolean; placeholder: boolean };
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');

interface RequestOptions {
  withAuth?: boolean;
  token?: string;
  skipGlobalError?: boolean;
  context?: string;
}

export type ApiErrorHandler = (error: ApiError) => void;

let globalApiErrorHandler: ApiErrorHandler | null = (error) => {
  if (typeof window !== 'undefined') {
    toast.error(error.message || 'Une erreur API est survenue');
  }
};

export function setApiGlobalErrorHandler(handler: ApiErrorHandler | null) {
  globalApiErrorHandler = handler;
}

function getToken(providedToken?: string): string {
  if (providedToken) {
    return providedToken;
  }
  if (typeof window === 'undefined') {
    return '';
  }
  return localStorage.getItem('admin_token') || '';
}

function authHeaders(token?: string): HeadersInit {
  const accessToken = getToken(token);
  if (!accessToken) {
    return {};
  }
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

function emitApiError(error: ApiError, options?: RequestOptions) {
  if (options?.skipGlobalError) {
    return;
  }
  if (globalApiErrorHandler) {
    globalApiErrorHandler(error);
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const method = String(init?.method || 'GET').toUpperCase();
  const hasBody = typeof init?.body !== 'undefined';

  const headers: HeadersInit = {
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...(options.withAuth ? authHeaders(options.token) : {}),
    ...(init?.headers || {}),
  };

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
    });
  } catch (error) {
    const networkError = new Error(
      error instanceof Error ? error.message : 'Network request failed'
    ) as ApiError;
    networkError.code = 'NETWORK_ERROR';
    networkError.path = path;
    networkError.method = method;
    emitApiError(networkError, options);
    throw networkError;
  }

  const raw = await response.text();
  let payload: Record<string, any> = {};

  if (raw) {
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/json')) {
      try {
        payload = JSON.parse(raw);
      } catch (_error) {
        payload = {};
      }
    } else {
      payload = { message: raw };
    }
  }

  if (!response.ok) {
    const error = new Error(
      payload?.message || `HTTP ${response.status} ${response.statusText || 'API error'}`
    ) as ApiError;
    error.status = response.status;
    error.code = payload?.code;
    error.path = path;
    error.method = method;
    error.raw = payload;
    emitApiError(error, options);
    throw error;
  }

  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload as ApiResponse<T>;
  }

  return { data: payload as T };
}

export async function loginApi(email: string, password: string): Promise<AuthSession> {
  const response = await request<AuthSession>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }, { skipGlobalError: true, context: 'auth.login' });
  return response.data;
}

export async function meApi(token?: string): Promise<{ user: AuthUser }> {
  const response = await request<{ user: AuthUser }>('/auth/me', {
    method: 'GET',
  }, { withAuth: true, token, skipGlobalError: true, context: 'auth.me' });
  return response.data;
}

export async function refreshTokenApi(refreshToken: string): Promise<AuthSession> {
  const response = await request<AuthSession>(
    '/auth/refresh',
    {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    },
    { skipGlobalError: true, context: 'auth.refresh' }
  );
  return response.data;
}

export async function logoutApi(refreshToken?: string): Promise<{ success: boolean }> {
  const response = await request<{ success: boolean }>(
    '/auth/logout',
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        ...(refreshToken ? { refreshToken } : {}),
      }),
    },
    { skipGlobalError: true, context: 'auth.logout' }
  );
  return response.data;
}

export async function fetchHealthApi(): Promise<{ ok: boolean; service: string; timestamp: string }> {
  return (await request<{ ok: boolean; service: string; timestamp: string }>('/health', { method: 'GET' })).data;
}

export async function fetchOrdersApi(): Promise<OrderRecord[]> {
  return (await request<OrderRecord[]>('/orders', { method: 'GET', headers: authHeaders() })).data;
}

export async function fetchOrderByIdApi(id: string): Promise<OrderRecord> {
  return (
    await request<OrderRecord>(`/orders/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: authHeaders(),
    })
  ).data;
}

export async function createOrderApi(payload: Omit<OrderRecord, 'id'> & { id?: string }): Promise<OrderRecord> {
  return (
    await request<OrderRecord>('/orders', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
  ).data;
}

export async function createManualOrderApi(payload: ManualOrderPayload): Promise<OrderRecord> {
  return (
    await request<OrderRecord>('/orders/manual', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
  ).data;
}

export async function updateOrderApi(id: string, patch: Partial<OrderRecord>): Promise<OrderRecord> {
  return (
    await request<OrderRecord>(`/orders/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(patch),
    })
  ).data;
}

export async function deleteOrderApi(id: string): Promise<OrderRecord> {
  return (
    await request<OrderRecord>(`/orders/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
  ).data;
}

export async function fetchProductsApi(): Promise<ProductRecord[]> {
  return (await request<ProductRecord[]>('/products', { method: 'GET', headers: authHeaders() })).data;
}

export async function fetchProductByIdApi(id: string): Promise<ProductRecord> {
  return (
    await request<ProductRecord>(`/products/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: authHeaders(),
    })
  ).data;
}

export async function createProductApi(payload: Omit<ProductRecord, 'id'> & { id?: string }): Promise<ProductRecord> {
  return (
    await request<ProductRecord>('/products', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
  ).data;
}

export async function updateProductApi(id: string, patch: Partial<ProductRecord>): Promise<ProductRecord> {
  return (
    await request<ProductRecord>(`/products/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(patch),
    })
  ).data;
}

export async function deleteProductApi(id: string): Promise<ProductRecord> {
  return (
    await request<ProductRecord>(`/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
  ).data;
}

export async function fetchStockMovementsApi(params?: { productId?: string; type?: string; dateFrom?: string; dateTo?: string }): Promise<StockMovementRecord[]> {
  const query = new URLSearchParams();
  if (params?.productId) query.set('productId', params.productId);
  if (params?.type) query.set('type', params.type);
  if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params?.dateTo) query.set('dateTo', params.dateTo);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return (await request<StockMovementRecord[]>(`/stock/movements${suffix}`, { method: 'GET', headers: authHeaders() })).data;
}

export async function fetchStockAlertsApi(): Promise<StockAlertRecord[]> {
  return (await request<StockAlertRecord[]>('/stock/alerts', { method: 'GET', headers: authHeaders() })).data;
}

export async function adjustProductStockApi(
  productId: string,
  payload: { variantId?: string; quantity: number; type?: string; reason?: string }
): Promise<{ product: ProductRecord; movement: StockMovementRecord }> {
  return (
    await request<{ product: ProductRecord; movement: StockMovementRecord }>(
      `/products/${encodeURIComponent(productId)}/stock-movements`,
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      }
    )
  ).data;
}

export async function fetchCustomersApi(): Promise<CustomerRecord[]> {
  return (await request<CustomerRecord[]>('/customers', { method: 'GET', headers: authHeaders() })).data;
}

export async function fetchCustomerByIdApi(id: string): Promise<CustomerRecord> {
  return (
    await request<CustomerRecord>(`/customers/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: authHeaders(),
    })
  ).data;
}

export async function createCustomerApi(payload: Omit<CustomerRecord, 'id'> & { id?: string }): Promise<CustomerRecord> {
  return (
    await request<CustomerRecord>('/customers', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
  ).data;
}

export async function updateCustomerApi(id: string, patch: Partial<CustomerRecord>): Promise<CustomerRecord> {
  return (
    await request<CustomerRecord>(`/customers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(patch),
    })
  ).data;
}

export async function deleteCustomerApi(id: string): Promise<CustomerRecord> {
  return (
    await request<CustomerRecord>(`/customers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
  ).data;
}

export async function addCustomerNoteApi(id: string, text: string): Promise<CustomerRecord> {
  return (
    await request<CustomerRecord>(`/customers/${encodeURIComponent(id)}/notes`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ text }),
    })
  ).data;
}

export async function addCustomerReminderApi(
  id: string,
  payload: { title: string; dueAt: string; status?: string }
): Promise<CustomerRecord> {
  return (
    await request<CustomerRecord>(`/customers/${encodeURIComponent(id)}/reminders`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
  ).data;
}

export async function fetchAIOrdersApi(): Promise<AIOrderRecord[]> {
  return (await request<AIOrderRecord[]>('/ai-orders', { method: 'GET', headers: authHeaders() })).data;
}

export async function fetchAIOrderByIdApi(id: string): Promise<AIOrderRecord> {
  return (
    await request<AIOrderRecord>(`/ai-orders/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: authHeaders(),
    })
  ).data;
}

export async function createAIOrderApi(payload: Omit<AIOrderRecord, 'id'> & { id?: string }): Promise<AIOrderRecord> {
  return (
    await request<AIOrderRecord>('/ai-orders', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
  ).data;
}

export async function updateAIOrderApi(id: string, patch: Partial<AIOrderRecord>): Promise<AIOrderRecord> {
  return (
    await request<AIOrderRecord>(`/ai-orders/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(patch),
    })
  ).data;
}

export async function deleteAIOrderApi(id: string): Promise<AIOrderRecord> {
  return (
    await request<AIOrderRecord>(`/ai-orders/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
  ).data;
}

export async function fetchLeadsApi(params?: { search?: string; city?: string; status?: LeadStatus | '' }): Promise<LeadRecord[]> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.city) query.set('city', params.city);
  if (params?.status) query.set('status', params.status);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return (await request<LeadRecord[]>(`/leads${suffix}`, { method: 'GET', headers: authHeaders() })).data;
}

export async function createLeadApi(payload: Omit<LeadRecord, 'id'> & { id?: string }): Promise<LeadRecord> {
  return (
    await request<LeadRecord>('/leads', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
  ).data;
}

export async function updateLeadApi(id: string, patch: Partial<LeadRecord>): Promise<LeadRecord> {
  return (
    await request<LeadRecord>(`/leads/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(patch),
    })
  ).data;
}

export async function bulkLeadActionApi(ids: string[], action: 'add_to_crm' | 'mark_contacted' | 'mark_converted'): Promise<{ updatedCount: number }> {
  return (
    await request<{ updatedCount: number }>('/leads/bulk', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ ids, action }),
    })
  ).data;
}

export async function startLeadScrapeApi(payload: { query: string; category: string; city: string; limit: number }): Promise<ScrapeJob> {
  return (
    await request<ScrapeJob>('/leads/scrape-jobs', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
  ).data;
}

export async function fetchScrapeJobApi(id: string): Promise<ScrapeJob> {
  return (
    await request<ScrapeJob>(`/leads/scrape-jobs/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: authHeaders(),
    })
  ).data;
}

export async function fetchAgentChannelsApi(): Promise<Array<{ channel: Channel; total: number; unread: number }>> {
  return (await request<Array<{ channel: Channel; total: number; unread: number }>>('/agents/channels', { method: 'GET', headers: authHeaders() })).data;
}

export async function fetchAgentConversationsApi(channel?: Channel): Promise<ConversationRecord[]> {
  const suffix = channel ? `?channel=${encodeURIComponent(channel)}` : '';
  return (await request<ConversationRecord[]>(`/agents/conversations${suffix}`, { method: 'GET', headers: authHeaders() })).data;
}

export async function fetchAgentMessagesApi(conversationId: string): Promise<MessageRecord[]> {
  return (
    await request<MessageRecord[]>(`/agents/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: 'GET',
      headers: authHeaders(),
    })
  ).data;
}

export async function updateAgentConversationApi(
  conversationId: string,
  patch: Partial<Pick<ConversationRecord, 'unread' | 'lastMessage' | 'timestamp'>>
): Promise<ConversationRecord> {
  return (
    await request<ConversationRecord>(`/agents/conversations/${encodeURIComponent(conversationId)}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(patch),
    })
  ).data;
}

export async function sendAgentMessageApi(conversationId: string, text: string, sender: 'user' | 'contact' = 'user'): Promise<MessageRecord> {
  return (
    await request<MessageRecord>(`/agents/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ text, sender }),
    })
  ).data;
}

export async function fetchAgentSettingsApi(): Promise<AgentsSettings> {
  return (await request<AgentsSettings>('/agents/settings', { method: 'GET', headers: authHeaders() })).data;
}

export async function updateAgentSettingsApi(patch: Partial<AgentsSettings>): Promise<AgentsSettings> {
  return (
    await request<AgentsSettings>('/agents/settings', {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(patch),
    })
  ).data;
}

export async function fetchAgentRulesApi(): Promise<AgentRule[]> {
  return (await request<AgentRule[]>('/agents/rules', { method: 'GET', headers: authHeaders() })).data;
}

export async function createAgentRuleApi(payload: Omit<AgentRule, 'id'>): Promise<AgentRule> {
  return (
    await request<AgentRule>('/agents/rules', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
  ).data;
}

export async function updateAgentRuleApi(id: string, patch: Partial<AgentRule>): Promise<AgentRule> {
  return (
    await request<AgentRule>(`/agents/rules/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(patch),
    })
  ).data;
}

export async function deleteAgentRuleApi(id: string): Promise<AgentRule> {
  return (
    await request<AgentRule>(`/agents/rules/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
  ).data;
}

export async function fetchAgentSuggestionApi(conversationId: string): Promise<AgentSuggestionResponse> {
  return (
    await request<AgentSuggestionResponse>('/agents/suggestions', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ conversationId }),
    })
  ).data;
}

export async function chatWithDashboardAssistantApi(payload: {
  message: string;
  history?: DashboardAssistantTurn[];
  mode?: DashboardAssistantMode;
}): Promise<DashboardAssistantResponse> {
  return (
    await request<DashboardAssistantResponse>('/agents/dashboard-assistant', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
  ).data;
}

export async function analyzeSocialMessageApi(payload: {
  message: string;
  language?: 'fr' | 'en' | 'ar';
}): Promise<SocialMessageAnalysis> {
  return (
    await request<SocialMessageAnalysis>('/agents/social-analyze', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
  ).data;
}

export async function replyToSocialMessageApi(payload: {
  message: string;
  conversationId?: string;
  channel?: Channel;
  contact?: string;
  tone?: AgentsSettings['tone'];
  language?: AgentsSettings['language'];
  history?: Array<{ sender?: string; text?: string; content?: string; role?: string }>;
}): Promise<SocialAgentAnalysis> {
  return (
    await request<SocialAgentAnalysis>('/agents/social-reply', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
  ).data;
}

export async function extractOrderFromConversationApi(payload: {
  conversation_history?: string | Array<{ sender?: string; text?: string; content?: string; role?: string }>;
  conversationId?: string;
}): Promise<ExtractedOrderInfo> {
  return (
    await request<ExtractedOrderInfo>('/agents/extract-order', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
  ).data;
}

export async function analyzeCopilotApi(payload: { role: string; datePreset: string; question?: string }): Promise<CopilotAnalysis> {
  return (
    await request<CopilotAnalysis>('/copilot/analyze', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
  ).data;
}

export async function analyzeAdvancedCopilotApi(payload: { role: string; datePreset: string; question?: string; showSystemPrompt?: boolean }): Promise<AdvancedCopilotAnalysis> {
  return (
    await request<AdvancedCopilotAnalysis>('/copilot/advanced/analyze', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
  ).data;
}

export async function fetchSettingsApi(): Promise<AppSettings> {
  return (await request<AppSettings>('/settings', { method: 'GET', headers: authHeaders() })).data;
}

export async function updateSettingsApi(patch: Partial<AppSettings>): Promise<AppSettings> {
  return (
    await request<AppSettings>('/settings', {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(patch),
    })
  ).data;
}

export async function fetchAdminUsersApi(): Promise<AdminUserRecord[]> {
  return (await request<AdminUserRecord[]>('/admin-users', { method: 'GET', headers: authHeaders() })).data;
}

export async function createAdminUserApi(payload: { name: string; email: string; password: string; role: string; active?: boolean }): Promise<AdminUserRecord> {
  return (
    await request<AdminUserRecord>('/admin-users', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
  ).data;
}

export async function updateAdminUserApi(id: string, patch: Partial<{ name: string; email: string; password: string; role: string; active: boolean }>): Promise<AdminUserRecord> {
  return (
    await request<AdminUserRecord>(`/admin-users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(patch),
    })
  ).data;
}

export async function deleteAdminUserApi(id: string): Promise<AdminUserRecord> {
  return (
    await request<AdminUserRecord>(`/admin-users/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
  ).data;
}

export async function fetchNotificationsApi(): Promise<NotificationRecord[]> {
  return (await request<NotificationRecord[]>('/notifications', { method: 'GET', headers: authHeaders() })).data;
}

export async function markNotificationReadApi(id: string): Promise<NotificationRecord> {
  return (
    await request<NotificationRecord>(`/notifications/${encodeURIComponent(id)}/read`, {
      method: 'PATCH',
      headers: authHeaders(),
    })
  ).data;
}

export async function markAllNotificationsReadApi(): Promise<{ updatedCount: number }> {
  return (
    await request<{ updatedCount: number }>('/notifications/mark-all-read', {
      method: 'POST',
      headers: authHeaders(),
    })
  ).data;
}

export async function deleteNotificationApi(id: string): Promise<NotificationRecord> {
  return (
    await request<NotificationRecord>(`/notifications/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
  ).data;
}

export async function createNotificationApi(payload: {
  type?: NotificationRecord['type'];
  priority?: NotificationRecord['priority'];
  title: string;
  message: string;
  time?: string;
  link?: string;
  entityType?: string;
  entityId?: string;
  dedupeKey?: string;
}): Promise<NotificationRecord> {
  return (
    await request<NotificationRecord>('/notifications', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
  ).data;
}

export async function fetchDeliveriesApi(params?: { status?: string; city?: string }): Promise<DeliveryRecord[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.city) query.set('city', params.city);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return (await request<DeliveryRecord[]>(`/deliveries${suffix}`, { method: 'GET', headers: authHeaders() })).data;
}

export async function createDeliveryApi(payload: Partial<DeliveryRecord>): Promise<DeliveryRecord> {
  return (
    await request<DeliveryRecord>('/deliveries', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
  ).data;
}

export async function updateDeliveryApi(id: string, patch: Partial<DeliveryRecord>): Promise<DeliveryRecord> {
  return (
    await request<DeliveryRecord>(`/deliveries/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(patch),
    })
  ).data;
}

export async function fetchDailyDeliveryReportApi(date?: string): Promise<{ date: string; total: number; byStatus: Record<string, number>; deliveries: DeliveryRecord[] }> {
  const suffix = date ? `?date=${encodeURIComponent(date)}` : '';
  return (await request<{ date: string; total: number; byStatus: Record<string, number>; deliveries: DeliveryRecord[] }>(`/deliveries/report/daily${suffix}`, { method: 'GET', headers: authHeaders() })).data;
}

export async function fetchInvoicesApi(params?: { status?: string; dateFrom?: string; dateTo?: string; customer?: string }): Promise<InvoiceRecord[]> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== 'all') query.set('status', params.status);
  if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params?.dateTo) query.set('dateTo', params.dateTo);
  if (params?.customer) query.set('customer', params.customer);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return (await request<InvoiceRecord[]>(`/invoices${suffix}`, { method: 'GET', headers: authHeaders() })).data;
}

export async function fetchInvoiceByIdApi(id: string): Promise<InvoiceRecord> {
  return (await request<InvoiceRecord>(`/invoices/${encodeURIComponent(id)}`, { method: 'GET', headers: authHeaders() })).data;
}

export async function generateInvoiceApi(payload: string | InvoiceCreatePayload): Promise<InvoiceRecord> {
  const body = typeof payload === 'string' ? { orderId: payload } : payload;
  return (
    await request<InvoiceRecord>('/invoices/generate', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    })
  ).data;
}

export async function fetchDeliveryNotesApi(params?: { status?: string; dateFrom?: string; dateTo?: string; customer?: string; orderId?: string }): Promise<DeliveryNoteRecord[]> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== 'all') query.set('status', params.status);
  if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params?.dateTo) query.set('dateTo', params.dateTo);
  if (params?.customer) query.set('customer', params.customer);
  if (params?.orderId) query.set('orderId', params.orderId);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return (await request<DeliveryNoteRecord[]>(`/delivery-notes${suffix}`, { method: 'GET', headers: authHeaders() })).data;
}

export async function fetchDeliveryNoteByIdApi(id: string): Promise<DeliveryNoteRecord> {
  return (await request<DeliveryNoteRecord>(`/delivery-notes/${encodeURIComponent(id)}`, { method: 'GET', headers: authHeaders() })).data;
}

export async function generateDeliveryNoteApi(orderId: string): Promise<DeliveryNoteRecord> {
  return (
    await request<DeliveryNoteRecord>(`/orders/${encodeURIComponent(orderId)}/delivery-note`, {
      method: 'POST',
      headers: authHeaders(),
    })
  ).data;
}

export async function generateDeliveryNoteFromOrderApi(orderId: string): Promise<DeliveryNoteRecord> {
  return (
    await request<DeliveryNoteRecord>('/delivery-notes/generate', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ orderId }),
    })
  ).data;
}

export async function downloadDeliveryNotePdfApi(id: string): Promise<{ filename: string; contentType: string; base64: string }> {
  return (await request<{ filename: string; contentType: string; base64: string }>(`/delivery-notes/${encodeURIComponent(id)}/pdf`, { method: 'GET', headers: authHeaders() })).data;
}

export async function createInvoiceFromOrderApi(payload: InvoiceCreatePayload): Promise<InvoiceRecord> {
  return (
    await request<InvoiceRecord>('/invoices', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
  ).data;
}

export async function updateInvoiceApi(id: string, patch: Partial<InvoiceRecord>): Promise<InvoiceRecord> {
  return (
    await request<InvoiceRecord>(`/invoices/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(patch),
    })
  ).data;
}

export async function sendInvoicePlaceholderApi(id: string, payload?: { to?: string; channel?: string; message?: string }): Promise<InvoiceRecord> {
  return (
    await request<InvoiceRecord>(`/invoices/${encodeURIComponent(id)}/send`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload || {}),
    })
  ).data;
}

export async function downloadInvoicePdfApi(id: string): Promise<{ filename: string; contentType: string; base64: string }> {
  return (await request<{ filename: string; contentType: string; base64: string }>(`/invoices/${encodeURIComponent(id)}/pdf`, { method: 'GET', headers: authHeaders() })).data;
}

export async function fetchAccountingSummaryApi(): Promise<AccountingSummary> {
  return (await request<AccountingSummary>('/accounting/summary', { method: 'GET', headers: authHeaders() })).data;
}

export async function fetchAccountingDashboardApi(): Promise<AccountingDashboard> {
  return (await request<AccountingDashboard>('/accounting/dashboard', { method: 'GET', headers: authHeaders() })).data;
}

export async function exportAccountingCsvApi(): Promise<{ filename: string; contentType: string; content: string }> {
  return (await request<{ filename: string; contentType: string; content: string }>('/accounting/export.csv', { method: 'GET', headers: authHeaders() })).data;
}

export async function fetchExpensesApi(params?: { category?: string; dateFrom?: string; dateTo?: string }): Promise<ExpenseRecord[]> {
  const query = new URLSearchParams();
  if (params?.category && params.category !== 'all') query.set('category', params.category);
  if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params?.dateTo) query.set('dateTo', params.dateTo);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return (await request<ExpenseRecord[]>(`/expenses${suffix}`, { method: 'GET', headers: authHeaders() })).data;
}

export async function createExpenseApi(payload: { title?: string; label?: string; category: string; amount: number; date?: string; paymentMethod?: string; note?: string; notes?: string }): Promise<ExpenseRecord> {
  return (
    await request<ExpenseRecord>('/expenses', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
  ).data;
}

export async function fetchMarketingCampaignsApi(params?: { status?: string }): Promise<MarketingCampaignRecord[]> {
  const suffix = params?.status ? `?status=${encodeURIComponent(params.status)}` : '';
  return (await request<MarketingCampaignRecord[]>(`/marketing/campaigns${suffix}`, { method: 'GET', headers: authHeaders() })).data;
}

export async function createMarketingCampaignApi(payload: Partial<MarketingCampaignRecord>): Promise<MarketingCampaignRecord> {
  return (
    await request<MarketingCampaignRecord>('/marketing/campaigns', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
  ).data;
}

export async function updateMarketingCampaignApi(id: string, patch: Partial<MarketingCampaignRecord>): Promise<MarketingCampaignRecord> {
  return (
    await request<MarketingCampaignRecord>(`/marketing/campaigns/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(patch),
    })
  ).data;
}

export async function fetchMarketingTemplatesApi(): Promise<MarketingTemplateRecord[]> {
  return (await request<MarketingTemplateRecord[]>('/marketing/templates', { method: 'GET', headers: authHeaders() })).data;
}

export async function generateMarketingCopyApi(payload: { product?: string; audience?: string; segment?: string; topic?: string }): Promise<{ subject: string; body: string }> {
  return (
    await request<{ subject: string; body: string }>('/marketing/generate-copy', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
  ).data;
}

export async function fetchAdCampaignsApi(params?: { platform?: string }): Promise<AdCampaignRecord[]> {
  const suffix = params?.platform ? `?platform=${encodeURIComponent(params.platform)}` : '';
  return (await request<AdCampaignRecord[]>(`/ads/campaigns${suffix}`, { method: 'GET', headers: authHeaders() })).data;
}

export async function createAdCampaignApi(payload: Partial<AdCampaignRecord>): Promise<AdCampaignRecord> {
  return (
    await request<AdCampaignRecord>('/ads/campaigns', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
  ).data;
}

export async function updateAdCampaignApi(id: string, patch: Partial<AdCampaignRecord>): Promise<AdCampaignRecord> {
  return (
    await request<AdCampaignRecord>(`/ads/campaigns/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(patch),
    })
  ).data;
}

export async function generateAdCopyApi(payload: { product?: string; audience?: string; topic?: string }): Promise<{ headline: string; primaryText: string; ideas: string[] }> {
  return (
    await request<{ headline: string; primaryText: string; ideas: string[] }>('/ads/generate-copy', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
  ).data;
}

export async function fetchAnalyticsOverviewApi(): Promise<AnalyticsOverview> {
  return (await request<AnalyticsOverview>('/analytics/overview', { method: 'GET', headers: authHeaders() })).data;
}

export async function fetchIntegrationSettingsApi(): Promise<IntegrationRecord[]> {
  return (await request<IntegrationRecord[]>('/integrations/settings', { method: 'GET', headers: authHeaders() })).data;
}

export async function fetchIntegrationsHealthApi(): Promise<IntegrationsHealth> {
  return (await request<IntegrationsHealth>('/integrations/health', { method: 'GET', headers: authHeaders() })).data;
}

export async function connectIntegrationApi(id: string, payload: { config?: Record<string, string> }): Promise<IntegrationRecord> {
  return (
    await request<IntegrationRecord>(`/integrations/${encodeURIComponent(id)}/connect`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
  ).data;
}

export async function disconnectIntegrationApi(id: string): Promise<IntegrationRecord> {
  return (
    await request<IntegrationRecord>(`/integrations/${encodeURIComponent(id)}/disconnect`, {
      method: 'POST',
      headers: authHeaders(),
    })
  ).data;
}

export async function testIntegrationConnectionApi(id: string): Promise<IntegrationRecord & { healthy: boolean }> {
  return (
    await request<IntegrationRecord & { healthy: boolean }>(`/integrations/${encodeURIComponent(id)}/test`, {
      method: 'POST',
      headers: authHeaders(),
    })
  ).data;
}

export async function fetchSalesChannelsApi(): Promise<SalesChannelRecord[]> {
  return (await request<SalesChannelRecord[]>('/sales-channels', { method: 'GET', headers: authHeaders() })).data;
}

export async function createSalesChannelApi(payload: Partial<SalesChannelRecord>): Promise<SalesChannelRecord> {
  return (
    await request<SalesChannelRecord>('/sales-channels', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
  ).data;
}

export async function updateSalesChannelApi(id: string, patch: Partial<SalesChannelRecord>): Promise<SalesChannelRecord> {
  return (
    await request<SalesChannelRecord>(`/sales-channels/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(patch),
    })
  ).data;
}

export async function syncSalesChannelProductsApi(id: string): Promise<SyncJobRecord> {
  return (
    await request<SyncJobRecord>(`/sales-channels/${encodeURIComponent(id)}/sync-products`, {
      method: 'POST',
      headers: authHeaders(),
    })
  ).data;
}

export async function syncSalesChannelOrdersApi(id: string): Promise<SyncJobRecord> {
  return (
    await request<SyncJobRecord>(`/sales-channels/${encodeURIComponent(id)}/sync-orders`, {
      method: 'POST',
      headers: authHeaders(),
    })
  ).data;
}

export async function fetchSyncJobsApi(): Promise<SyncJobRecord[]> {
  return (await request<SyncJobRecord[]>('/sync-jobs', { method: 'GET', headers: authHeaders() })).data;
}

export async function searchApi(query: string): Promise<GlobalSearchResult[]> {
  const q = encodeURIComponent(query);
  return (await request<GlobalSearchResult[]>(`/search?q=${q}`, { method: 'GET', headers: authHeaders() })).data;
}
