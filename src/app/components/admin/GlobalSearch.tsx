import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Search, Package, ShoppingCart, Users, UserPlus } from 'lucide-react';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '../ui/utils';
import { GlobalSearchResult, searchApi } from '../../services/api';

export function GlobalSearch({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const getIcon = (type: string) => {
    switch (type) {
      case 'order':
        return <ShoppingCart size={16} />;
      case 'product':
        return <Package size={16} />;
      case 'customer':
        return <Users size={16} />;
      case 'lead':
        return <UserPlus size={16} />;
      default:
        return <Search size={16} />;
    }
  };

  const runSearch = async (value: string) => {
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const data = await searchApi(value.trim());
      setResults(data);
    } catch (_error) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (value: string) => {
    setQuery(value);
    setOpen(true);
    void runSearch(value);
  };

  const handleResultClick = (result: GlobalSearchResult) => {
    setQuery('');
    setOpen(false);
    navigate(result.path || '/admin');
  };

  return (
    <Popover open={open && query.length > 0} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn('relative', className)}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            placeholder="Rechercher commandes, produits, clients..."
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            className="pl-10 w-full md:w-80"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        {loading ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">Recherche en cours...</div>
        ) : results.length > 0 ? (
          <div className="space-y-1">
            {results.map((result) => (
              <button
                key={result.id}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent text-left"
                onClick={() => handleResultClick(result)}
              >
                <div className="text-muted-foreground">{getIcon(result.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{result.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">Aucun resultat trouve</div>
        )}
      </PopoverContent>
    </Popover>
  );
}
