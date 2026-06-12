import { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { normalizeRole, useRole } from '../../contexts/RoleContext';
import type { UserRole } from '../../constants';
import { Card } from '../ui/card';

interface ProtectedPageProps {
  children: ReactNode;
  allowedRoles: UserRole[];
  redirect?: string;
}

export function ProtectedPage({ children, allowedRoles, redirect = '/admin' }: ProtectedPageProps) {
  const { role: localRole } = useRole();
  const { user } = useAuth();

  const effectiveRole = normalizeRole(user?.role || localRole);
  const hasAccess = allowedRoles.includes(effectiveRole);

  if (!hasAccess) {
    if (redirect) {
      return <Navigate to={redirect} replace />;
    }

    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-8 max-w-md text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <h2 className="text-xl font-bold mb-2">Acces restreint</h2>
          <p className="text-muted-foreground mb-4">
            Cette page est reservee aux roles : {allowedRoles.join(', ')}
          </p>
          <p className="text-sm text-muted-foreground">
            Votre role actuel : <span className="font-medium">{effectiveRole}</span>
          </p>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
