import { createBrowserRouter, Navigate } from 'react-router';

function RouteLoading() {
  return (
    <div className="flex min-h-40 items-center justify-center">
      <p className="text-sm text-muted-foreground">Chargement...</p>
    </div>
  );
}

const hydrateFallbackElement = <RouteLoading />;

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/admin/login" replace />,
  },
  {
    path: '/admin/login',
    hydrateFallbackElement,
    lazy: async () => {
      const { LoginPage } = await import('./pages/LoginPage');
      return { Component: LoginPage };
    },
  },
  {
    path: '/admin',
    hydrateFallbackElement,
    lazy: async () => {
      const { AdminLayout } = await import('./components/admin/AdminLayout');
      return { Component: AdminLayout };
    },
    children: [
      {
        index: true,
        hydrateFallbackElement,
        lazy: async () => {
          const { HomePage } = await import('./pages/HomePage');
          return { Component: HomePage };
        },
      },
      {
        path: 'analytics',
        hydrateFallbackElement,
        lazy: async () => {
          const { AnalyticsPage } = await import('./pages/AnalyticsPage');
          return { Component: AnalyticsPage };
        },
      },
      {
        path: 'orders',
        hydrateFallbackElement,
        lazy: async () => {
          const { OrdersPage } = await import('./pages/OrdersPage');
          return { Component: OrdersPage };
        },
      },
      {
        path: 'orders/:id',
        hydrateFallbackElement,
        lazy: async () => {
          const { OrderDetailsPage } = await import('./pages/OrderDetailsPage');
          return { Component: OrderDetailsPage };
        },
      },
      {
        path: 'products',
        hydrateFallbackElement,
        lazy: async () => {
          const { ProductsPage } = await import('./pages/ProductsPage');
          return { Component: ProductsPage };
        },
      },
      {
        path: 'stock',
        hydrateFallbackElement,
        lazy: async () => {
          const { StockPage } = await import('./pages/StockPage');
          return { Component: StockPage };
        },
      },
      {
        path: 'customers',
        hydrateFallbackElement,
        lazy: async () => {
          const { CustomersPage } = await import('./pages/CustomersPage');
          return { Component: CustomersPage };
        },
      },
      {
        path: 'marketing',
        hydrateFallbackElement,
        lazy: async () => {
          const { MarketingPage } = await import('./pages/MarketingPage');
          return { Component: MarketingPage };
        },
      },
      {
        path: 'email-sms',
        hydrateFallbackElement,
        lazy: async () => {
          const { EmailSmsMarketingPage } = await import('./pages/EmailSmsMarketingPage');
          return { Component: EmailSmsMarketingPage };
        },
      },
      {
        path: 'ads',
        hydrateFallbackElement,
        lazy: async () => {
          const { AdsPage } = await import('./pages/AdsPage');
          return { Component: AdsPage };
        },
      },
      {
        path: 'delivery',
        hydrateFallbackElement,
        lazy: async () => {
          const { DeliveryPage } = await import('./pages/DeliveryPage');
          return { Component: DeliveryPage };
        },
      },
      {
        path: 'invoices',
        hydrateFallbackElement,
        lazy: async () => {
          const { InvoicesAccountingPage } = await import('./pages/InvoicesAccountingPage');
          return { Component: InvoicesAccountingPage };
        },
      },
      {
        path: 'accounting',
        hydrateFallbackElement,
        lazy: async () => {
          const { AccountingPage } = await import('./pages/AccountingPage');
          return { Component: AccountingPage };
        },
      },
      {
        path: 'delivery-notes',
        hydrateFallbackElement,
        lazy: async () => {
          const { DeliveryNotesPage } = await import('./pages/DeliveryNotesPage');
          return { Component: DeliveryNotesPage };
        },
      },
      {
        path: 'sales-channels',
        hydrateFallbackElement,
        lazy: async () => {
          const { SalesChannelsPage } = await import('./pages/SalesChannelsPage');
          return { Component: SalesChannelsPage };
        },
      },
      {
        path: 'integrations-settings',
        hydrateFallbackElement,
        lazy: async () => {
          const { IntegrationsSettingsPage } = await import('./pages/IntegrationsSettingsPage');
          return { Component: IntegrationsSettingsPage };
        },
      },
      {
        path: 'map',
        hydrateFallbackElement,
        lazy: async () => {
          const { MapPage } = await import('./pages/MapPage');
          return { Component: MapPage };
        },
      },
      {
        path: 'geo',
        hydrateFallbackElement,
        lazy: async () => {
          const { GeoPage } = await import('./pages/MapPage');
          return { Component: GeoPage };
        },
      },
      {
        path: 'copilot',
        hydrateFallbackElement,
        lazy: async () => {
          const { CopilotPage } = await import('./pages/CopilotPage');
          return { Component: CopilotPage };
        },
      },
      {
        path: 'copilot-avance',
        hydrateFallbackElement,
        lazy: async () => {
          const { CopilotPage } = await import('./pages/CopilotPage');
          return {
            Component: function AdvancedCopilotRoute() {
              return <CopilotPage initialMode="advanced" />;
            },
          };
        },
      },
      {
        path: 'leads',
        hydrateFallbackElement,
        lazy: async () => {
          const { LeadsPage } = await import('./pages/LeadsPage');
          return { Component: LeadsPage };
        },
      },
      {
        path: 'agents-social',
        hydrateFallbackElement,
        lazy: async () => {
          const { AgentsSocialPage } = await import('./pages/AgentsSocialPage');
          return { Component: AgentsSocialPage };
        },
      },
      {
        path: 'commandes-ai',
        hydrateFallbackElement,
        lazy: async () => {
          const { CommandesAIPage } = await import('./pages/CommandesAIPage');
          return { Component: CommandesAIPage };
        },
      },
      {
        path: 'settings',
        hydrateFallbackElement,
        lazy: async () => {
          const { SettingsPage } = await import('./pages/SettingsPage');
          return { Component: SettingsPage };
        },
      },
      {
        path: 'components',
        hydrateFallbackElement,
        lazy: async () => {
          const { ComponentInventoryPage } = await import('./pages/ComponentInventoryPage');
          return { Component: ComponentInventoryPage };
        },
      },
    ],
  },
  {
    path: '*',
    element: (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">404</h1>
          <p className="text-muted-foreground">Page non trouvée</p>
        </div>
      </div>
    ),
  },
]);
