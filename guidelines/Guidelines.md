# Guidelines du Dashboard Admin E-Commerce

## Vue d'ensemble du projet

Ce dashboard administratif est une application web complète pour la gestion d'une boutique e-commerce avec un système d'interface utilisateur cohérent de style SaaS entreprise premium. L'application prend en charge plusieurs rôles utilisateurs, le mode clair/sombre, et offre 12 pages fonctionnelles complètes.

## Architecture et structure

### Structure des fichiers

```
/src/app/
├── App.tsx                 # Point d'entrée avec RouterProvider
├── routes.tsx              # Configuration React Router (Data mode)
├── components/
│   ├── admin/              # Composants spécifiques à l'admin
│   │   ├── AdminLayout.tsx # Layout partagé (sidebar + topbar)
│   │   ├── Sidebar.tsx     # Navigation latérale gauche
│   │   ├── Topbar.tsx      # Barre supérieure avec recherche/notifications
│   │   └── ...
│   ├── ui/                 # Composants UI réutilisables
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   └── ErrorBoundary.tsx
├── pages/                  # 12 pages du dashboard
│   ├── LoginPage.tsx
│   ├── HomePage.tsx
│   ├── AnalyticsPage.tsx
│   ├── OrdersPage.tsx
│   ├── ProductsPage.tsx
│   ├── CustomersPage.tsx
│   ├── MarketingPage.tsx
│   ├── DeliveryPage.tsx
│   ├── MapPage.tsx
│   ├── CopilotPage.tsx
│   ├── SettingsPage.tsx
│   └── ComponentInventoryPage.tsx
└── contexts/
    └── ThemeContext.tsx    # Gestion du mode clair/sombre

/src/styles/
├── index.css               # Styles globaux
├── theme.css               # Tokens et variables CSS
├── tailwind.css            # Configuration Tailwind v4
└── fonts.css               # Imports de polices
```

### Routes et navigation

**Scope de l'application :** `/admin/*`

**Pages disponibles :**

1. `/admin/login` - Page de connexion
2. `/admin/home` - Dashboard principal avec KPIs
3. `/admin/analytics` - Analyses détaillées et graphiques
4. `/admin/orders` - Gestion des commandes
5. `/admin/products` - Catalogue de produits
6. `/admin/customers` - Base clients
7. `/admin/marketing` - Campagnes marketing
8. `/admin/delivery` - Gestion des livraisons
9. `/admin/map` - Cartographie Tunisie
10. `/admin/copilot` - Assistant IA
11. `/admin/settings` - Paramètres
12. `/admin/components` - Inventaire des composants UI

## Système de design

### Système d'espacement 8pt

Tous les espacements doivent être des multiples de 8px :

- **4px** (0.5) : Espacement minimal
- **8px** (1) : Espacement petit
- **16px** (2) : Espacement moyen
- **24px** (3) : Espacement large
- **32px** (4) : Espacement extra-large
- **40px** (5), **48px** (6), **56px** (7), **64px** (8) : Espacements majeurs

Utiliser les classes Tailwind : `p-1`, `p-2`, `p-3`, `p-4`, `m-2`, `gap-4`, etc.

### Palette de couleurs

Les couleurs sont définies dans `/src/styles/theme.css` en utilisant les variables CSS :

```css
--color-primary: /* Couleur primaire */
--color-secondary: /* Couleur secondaire */
--color-background: /* Fond principal */
--color-foreground: /* Texte principal */
--color-muted: /* Couleurs atténuées */
--color-accent: /* Couleurs d'accentuation */
--color-destructive: /* Couleurs d'alerte/danger */
--color-border: /* Bordures */
```

### Mode clair/sombre

Le mode est géré par `ThemeContext` et persiste dans `localStorage`:

```tsx
import { useTheme } from '../contexts/ThemeContext';

function Component() {
  const { theme, toggleTheme } = useTheme();
  // theme peut être 'light' ou 'dark'
}
```

La classe `dark` est automatiquement ajoutée à `<html>` pour activer les styles sombres.

### Typographie

- **Ne pas** utiliser les classes Tailwind pour `font-size`, `font-weight`, ou `line-height` sauf si explicitement demandé
- Les éléments HTML (`h1`, `h2`, `h3`, `p`, etc.) ont des styles par défaut définis dans `theme.css`
- Utiliser les balises sémantiques appropriées

### Accessibilité

**Contraste :** Tous les textes doivent respecter WCAG AA (4.5:1 pour le texte normal)

**Composants Dialog :** Toujours inclure `DialogDescription` pour l'accessibilité :

```tsx
<Dialog>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Titre</DialogTitle>
      <DialogDescription>Description accessible</DialogDescription>
    </DialogHeader>
  </DialogContent>
</Dialog>
```

**Navigation clavier :** Tous les composants interactifs doivent être accessibles au clavier.

## Gestion des rôles

### Types de rôles

```typescript
type UserRole = 'Executive' | 'Opérations' | 'Marketing' | 'Support';
```

### Implémentation

Les rôles sont stockés dans `localStorage` avec la clé `'userRole'`:

```typescript
// Récupérer le rôle
const [currentRole, setCurrentRole] = useState<UserRole>(() => {
  if (typeof window !== 'undefined') {
    return (localStorage.getItem('userRole') as UserRole) || 'Executive';
  }
  return 'Executive';
});

// Changer de rôle
const handleRoleChange = (role: UserRole) => {
  setCurrentRole(role);
  localStorage.setItem('userRole', role);
};
```

### Contenu adaptatif par rôle

Le contenu et les KPIs doivent s'adapter selon le rôle :

- **Executive** : Vue d'ensemble stratégique, métriques financières
- **Opérations** : Commandes, inventaire, logistique
- **Marketing** : Campagnes, conversions, engagement
- **Support** : Tickets, satisfaction client, temps de réponse

## Composants réutilisables

### AdminLayout

Layout partagé pour toutes les pages protégées :

```tsx
import AdminLayout from '../components/admin/AdminLayout';

export default function MyPage() {
  return (
    <AdminLayout>
      {/* Contenu de la page */}
    </AdminLayout>
  );
}
```

**Structure :**
- Sidebar gauche (navigation)
- Topbar supérieure (recherche, notifications, profil)
- Zone de contenu principale avec padding `p-8`

### Cartes de statistiques (StatCard)

```tsx
<Card className="p-6">
  <div className="flex items-center justify-between mb-2">
    <p className="text-sm text-muted-foreground">Titre</p>
    <Icon className="h-5 w-5 text-muted-foreground" />
  </div>
  <div className="text-2xl font-bold">Valeur</div>
  <p className="text-xs text-muted-foreground mt-1">
    Variation ou description
  </p>
</Card>
```

### Graphiques

Utiliser **Recharts** pour tous les graphiques :

```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={300}>
  <LineChart data={data}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="name" />
    <YAxis />
    <Tooltip />
    <Line type="monotone" dataKey="value" stroke="#8884d8" />
  </LineChart>
</ResponsiveContainer>
```

### Icônes

Utiliser **lucide-react** pour toutes les icônes :

```tsx
import { User, Bell, Search, Settings } from 'lucide-react';

<User className="h-5 w-5" />
```

## Fonctionnalités spéciales

### Recherche globale

Implémentée dans le Topbar avec raccourci clavier `Cmd/Ctrl + K` :

```tsx
const SearchDialog = () => {
  const [open, setOpen] = useState(false);
  
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);
};
```

### Filtres de dates prédéfinis

Proposer des presets communs :

- Aujourd'hui
- 7 derniers jours
- 30 derniers jours
- Ce mois-ci
- 90 derniers jours
- Cette année
- Plage personnalisée

### Panneau de notifications

Afficher les notifications dans un Popover avec badge de compteur :

```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button variant="ghost" size="icon" className="relative">
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-white text-xs flex items-center justify-center">
          {unreadCount}
        </span>
      )}
    </Button>
  </PopoverTrigger>
  <PopoverContent>
    {/* Liste des notifications */}
  </PopoverContent>
</Popover>
```

### Sélecteur de rôle

Permettre le changement de rôle depuis le Topbar ou la page Settings :

```tsx
<Select value={currentRole} onValueChange={handleRoleChange}>
  <SelectTrigger>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="Executive">Executive</SelectItem>
    <SelectItem value="Opérations">Opérations</SelectItem>
    <SelectItem value="Marketing">Marketing</SelectItem>
    <SelectItem value="Support">Support</SelectItem>
  </SelectContent>
</Select>
```

## Gestion de l'état

### localStorage

**Attention :** Toujours vérifier que `window` est défini avant d'accéder à `localStorage` :

```tsx
// ✅ Correct
const [state, setState] = useState(() => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('key') || defaultValue;
  }
  return defaultValue;
});

// ❌ Incorrect (erreur SSR)
const [state, setState] = useState(localStorage.getItem('key'));
```

### Données mockées

Utiliser des données mockées réalistes pour toutes les pages :

```tsx
const mockOrders = [
  { id: 'CMD-001', client: 'Client A', montant: 1250, statut: 'En cours' },
  { id: 'CMD-002', client: 'Client B', montant: 890, statut: 'Livré' },
  // ...
];
```

## Bonnes pratiques

### Composants

1. **Un composant = Un fichier** avec le même nom
2. **Export default** pour les pages principales
3. **Export nommé** pour les composants réutilisables
4. **Props typées** avec TypeScript/JSDoc
5. **Décomposition** : Préférer plusieurs petits composants à un gros

### Performance

1. Utiliser `key` unique pour les listes (jamais l'index)
2. Mémoïser les callbacks coûteux avec `useMemo`/`useCallback` si nécessaire
3. Lazy load les pages lourdes si besoin

### Style

1. **Tailwind d'abord** : Utiliser les classes Tailwind pour le styling
2. **Classes conditionnelles** : Utiliser template literals ou `cn()` helper
3. **Responsive** : Mobile-first, utiliser `sm:`, `md:`, `lg:`, `xl:`
4. **Cohérence** : Réutiliser les mêmes espacements et couleurs

### Internationalisation

1. **Français par défaut** : Tous les labels en français
2. **Format de date** : DD/MM/YYYY (format français)
3. **Nombres** : Espace comme séparateur de milliers (1 000 000)
4. **Devise** : € (Euro) avec espace (1 250 €)

## Tests et débogage

### ErrorBoundary

Toutes les pages sont wrappées dans un ErrorBoundary pour capturer les erreurs :

```tsx
// Déjà configuré dans routes.tsx
{
  path: '/admin',
  Component: AdminLayout,
  errorElement: <ErrorBoundary />
}
```

### Console logs

Retirer tous les `console.log()` avant la production, sauf pour les erreurs critiques.

### Build

Vérifier qu'il n'y a pas d'erreurs TypeScript ou de lint :

```bash
npm run build
```

## Package dependencies

### Packages installés

- `react-router` : Routing (utiliser react-router, PAS react-router-dom)
- `lucide-react` : Icônes
- `recharts` : Graphiques
- `leaflet` + `react-leaflet` : Cartographie
- `@types/leaflet` : Types TypeScript pour Leaflet
- Composants UI shadcn/ui personnalisés

### Installation de nouveaux packages

Toujours utiliser `install_package` tool :

```tsx
// Vérifier d'abord package.json
// Puis installer si nécessaire
```

## Pages spécifiques

### LoginPage

- **Non protégée** (accessible sans authentification)
- Formulaire avec email + mot de passe
- Redirection vers `/admin/home` après connexion
- Stockage de l'état d'authentification dans localStorage

### HomePage

- Vue d'ensemble du dashboard
- 4-6 KPIs principaux selon le rôle
- Graphique de tendance
- Liste d'activité récente
- Changement de contenu selon le rôle actif

### AnalyticsPage

- Multiples graphiques (lignes, barres, aires)
- Filtres de dates prédéfinis
- Export de données (bouton mocké)
- Métriques détaillées par catégorie

### OrdersPage

- Table des commandes avec tri et filtres
- Statuts : En attente, En cours, Livré, Annulé
- Actions : Voir détails, Modifier, Annuler
- Pagination

### ProductsPage

- Grille de produits avec images
- Catégories et filtres
- Gestion du stock
- Ajout/Edition de produits

### CustomersPage

- Liste clients avec segments
- Statistiques CLV (Customer Lifetime Value)
- Historique d'achats
- Détails du profil client

### MarketingPage

- Campagnes actives
- Métriques de conversion
- ROI et performances
- Création de nouvelle campagne

### DeliveryPage

- Suivi des livraisons
- Statuts en temps réel
- Affectation aux livreurs
- Métriques de performance logistique

### MapPage

- Carte interactive de la Tunisie (Leaflet)
- Marqueurs pour les commandes/livraisons
- Clusters pour regroupement
- Popups avec informations

### CopilotPage

- Interface chat IA
- Messages de l'utilisateur et de l'assistant
- Suggestions intelligentes
- Historique de conversation
- Actions rapides

### SettingsPage

- Profil utilisateur
- Préférences d'affichage (mode clair/sombre)
- Sélecteur de rôle
- Notifications
- Sécurité

### ComponentInventoryPage

- Showcase de tous les composants UI
- Documentation visuelle
- Code examples
- Variations et états

## Checklist de développement

Avant de considérer une feature comme terminée :

- [ ] Fonctionne en mode clair ET sombre
- [ ] Responsive (mobile, tablette, desktop)
- [ ] Textes en français
- [ ] Pas d'erreurs console
- [ ] Accessibilité (ARIA labels, descriptions)
- [ ] Données mockées réalistes
- [ ] Gestion des états vides
- [ ] Gestion des erreurs
- [ ] localStorage géré correctement (window check)
- [ ] Espacement système 8pt respecté
- [ ] Composants réutilisables utilisés
- [ ] Code formaté et clean

## Ressources

- **Tailwind CSS v4** : https://tailwindcss.com/
- **React Router** : https://reactrouter.com/
- **Lucide Icons** : https://lucide.dev/
- **Recharts** : https://recharts.org/
- **Leaflet** : https://leafletjs.com/

---

**Version** : 1.0  
**Dernière mise à jour** : Mars 2026  
**Mainteneur** : Équipe Dashboard Admin
