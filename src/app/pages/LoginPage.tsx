import { useState } from 'react';
import { Navigate } from 'react-router';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import type { ApiError } from '../services/api';

function resolveLoginErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Email ou mot de passe incorrect';
  }

  const apiError = error as ApiError;
  if (apiError.code === 'INVALID_CREDENTIALS') {
    return 'Email ou mot de passe incorrect';
  }

  if (apiError.code === 'VALIDATION_ERROR') {
    return 'Veuillez remplir tous les champs';
  }

  if (error.message === 'Invalid credentials') {
    return 'Email ou mot de passe incorrect';
  }

  if (error.message === 'Failed to fetch') {
    return 'Impossible de contacter le serveur';
  }

  return error.message;
}

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleForgotPassword = () => {
    window.location.href = 'mailto:support@client.com?subject=Reinitialisation%20du%20mot%20de%20passe';
  };

  if (isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email || !password) {
        throw new Error('Veuillez remplir tous les champs');
      }
      await login(email, password);
    } catch (err) {
      setError(resolveLoginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:flex-1 bg-primary text-primary-foreground p-12 flex-col justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-4">Admin Console</h1>
          <p className="text-lg opacity-90">Console d'administration</p>
        </div>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
              ✓
            </div>
            <div>
              <h3 className="font-semibold mb-1">Gestion centralisée</h3>
              <p className="text-sm opacity-80">
                Gérez vos commandes, produits et clients depuis une seule interface
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
              ✓
            </div>
            <div>
              <h3 className="font-semibold mb-1">Analytics en temps réel</h3>
              <p className="text-sm opacity-80">
                Suivez vos performances avec des indicateurs précis
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
              ✓
            </div>
            <div>
              <h3 className="font-semibold mb-1">Sécurisé et fiable</h3>
              <p className="text-sm opacity-80">
                Vos données sont protégées avec les standards les plus élevés
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Connexion</h2>
            <p className="text-muted-foreground">
              Accédez à votre espace d'administration
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3">
              <AlertCircle className="text-destructive flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 animate-spin" size={16} />
                  Connexion en cours...
                </>
              ) : (
                'Se connecter'
              )}
            </Button>

            <div className="text-center">
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={handleForgotPassword}
              >
                Mot de passe oublié ?
              </button>
            </div>
          </form>

          <div className="mt-8 p-4 rounded-lg bg-muted/50 border">
            <p className="text-xs text-muted-foreground text-center">
              Votre session est sécurisée et expira après 24 heures d'inactivité
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
