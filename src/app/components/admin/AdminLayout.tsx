import { useState } from 'react';
import { Outlet, Link, useLocation, Navigate } from 'react-router';
import {
  LayoutDashboard,
  BarChart3,
  ShoppingCart,
  Package,
  PackageSearch,
  Users,
  Megaphone,
  Truck,
  Receipt,
  Store,
  Plug,
  Map,
  Settings,
  Bell,
  FileText,
  Search,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  ChevronDown,
  User,
  UserPlus,
  MessageSquare,
  Sparkles,
  WalletCards,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useRole } from '../../contexts/RoleContext';
import { RoleSwitcher } from './RoleSwitcher';
import { GlobalSearch } from './GlobalSearch';
import { NotificationsPanel } from './NotificationsPanel';
import { DatePresetFilter, DatePreset } from './DatePresetFilter';
import { DashboardAssistantWidget } from './DashboardAssistantWidget';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { cn } from '../ui/utils';

const mainNavItems = [
  { path: '/admin', label: 'Accueil', icon: LayoutDashboard, exact: true },
  { path: '/admin/orders', label: 'Commandes', icon: ShoppingCart },
  { path: '/admin/products', label: 'Produits', icon: Package },
  { path: '/admin/stock', label: 'Stock', icon: PackageSearch },
  { path: '/admin/customers', label: 'Clients', icon: Users },
  { path: '/admin/delivery', label: 'Livraison', icon: Truck },
  { path: '/admin/invoices', label: 'Factures', icon: Receipt },
  { path: '/admin/accounting', label: 'Comptabilite', icon: WalletCards },
  { path: '/admin/delivery-notes', label: 'Bons livraison', icon: FileText },
  { path: '/admin/marketing', label: 'Marketing', icon: Megaphone },
  { path: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/admin/settings', label: 'Paramètres', icon: Settings },
];

const advancedNavItems = [
  { path: '/admin/sales-channels', label: 'Vendre en ligne', icon: Store },
  { path: '/admin/integrations-settings', label: 'Integrations', icon: Plug },
  { path: '/admin/email-sms', label: 'Email / SMS', icon: Megaphone },
  { path: '/admin/ads', label: 'Publicite', icon: BarChart3 },
  { path: '/admin/map', label: 'Geo', icon: Map },
  { path: '/admin/leads', label: 'Leads', icon: UserPlus },
  { path: '/admin/agents-social', label: 'Social Inbox', icon: MessageSquare },
  { path: '/admin/commandes-ai', label: 'Commandes IA', icon: ShoppingCart },
  { path: '/admin/copilot', label: 'Copilot IA', icon: Sparkles },
];

export function AdminLayout() {
  const location = useLocation();
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { role } = useRole();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>('30j');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Chargement de la session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  const isActive = (path: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-card border-r shadow-lg transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 lg:shadow-none',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-6 border-b bg-gradient-to-r from-primary/5 to-transparent">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">AC</span>
              </div>
              <h1 className="text-lg font-bold">Admin Console</h1>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={20} />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-6">
            <div>
              <div className="space-y-1">
                {mainNavItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path, item.exact);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                        active
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-primary/10 hover:text-primary hover:translate-x-1'
                      )}
                    >
                      <Icon size={18} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Avancé
              </p>
              <div className="space-y-1">
                {advancedNavItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                        active
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-primary/10 hover:text-primary hover:translate-x-1'
                      )}
                    >
                      <Icon size={18} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>

          {/* Role Badge */}
          <div className="p-4 border-t">
            <div className="px-3 py-2 rounded-lg bg-accent/50 text-sm">
              <p className="text-xs text-muted-foreground mb-1">Rôle actuel</p>
              <p className="font-medium">{role}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 border-b bg-card px-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </Button>

          <GlobalSearch className="flex-1 max-w-2xl" />

          <div className="flex items-center gap-2">
            <DatePresetFilter 
              value={datePreset}
              onChange={(preset) => setDatePreset(preset)}
              className="hidden md:flex"
            />

            <div className="hidden xl:block">
              <RoleSwitcher />
            </div>

            <NotificationsPanel />

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User size={16} />
                  </div>
                  <span className="hidden md:inline">{user?.name}</span>
                  <ChevronDown size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive">
                  <LogOut size={16} className="mr-2" />
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <Outlet />
        </main>
      </div>

      <DashboardAssistantWidget />
    </div>
  );
}
