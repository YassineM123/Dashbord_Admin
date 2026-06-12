import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';

export type Role = 'Executive' | 'Operations' | 'Marketing' | 'Support';

const LEGACY_OPERATIONS_LABELS = new Set([
  'operations',
  'operation',
  'opérations',
  'opÃ©rations',
]);

export function normalizeRole(input: unknown): Role {
  const value = String(input || '')
    .trim()
    .toLowerCase();

  if (value === 'executive') return 'Executive';
  if (LEGACY_OPERATIONS_LABELS.has(value)) return 'Operations';
  if (value === 'marketing') return 'Marketing';
  if (value === 'support') return 'Support';
  return 'Executive';
}

interface RoleContextType {
  role: Role;
  setRole: (role: Role) => void;
  hasAccess: (requiredRoles: Role[]) => boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [role, setRoleState] = useState<Role>(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedRole = localStorage.getItem('admin_role');
        if (storedRole) {
          return normalizeRole(storedRole);
        }
      } catch (error) {
        console.error('Error loading role:', error);
      }
    }
    return 'Executive';
  });

  useEffect(() => {
    if (!user?.role) {
      return;
    }

    const normalized = normalizeRole(user.role);
    setRoleState(normalized);
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_role', normalized);
    }
  }, [user?.role]);

  const setRole = (newRole: Role) => {
    const normalized = normalizeRole(newRole);
    try {
      localStorage.setItem('admin_role', normalized);
      setRoleState(normalized);
    } catch (error) {
      console.error('Error saving role:', error);
      setRoleState(normalized);
    }
  };

  const hasAccess = useMemo(
    () => (requiredRoles: Role[]) => requiredRoles.includes(role),
    [role]
  );

  return (
    <RoleContext.Provider value={{ role, setRole, hasAccess }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
