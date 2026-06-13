import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import {
  AuthSession,
  AuthUser,
  loginApi,
  logoutApi,
  meApi,
  refreshTokenApi,
} from '../services/api';

const STORAGE_KEYS = {
  accessToken: 'admin_token',
  refreshToken: 'admin_refresh_token',
  accessTokenExpiresAt: 'admin_token_expires_at',
  refreshTokenExpiresAt: 'admin_refresh_token_expires_at',
  user: 'admin_user',
};

const DEMO_ACCESS_TOKEN = 'demo-access-token';
const DEMO_REFRESH_TOKEN = 'demo-refresh-token';

type User = AuthUser;

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getStorageItem(key: string) {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(key) || '';
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4;
    const padded = padding ? normalized + '='.repeat(4 - padding) : normalized;
    const json = atob(padded);
    return JSON.parse(json);
  } catch (_error) {
    return null;
  }
}

function extractExpiryMsFromToken(token: string): number | null {
  const payload = decodeJwtPayload(token);
  const exp = Number(payload?.exp || 0);
  if (!Number.isFinite(exp) || exp <= 0) return null;
  return exp * 1000;
}

function getExpiryMsFromIso(value: string): number | null {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function clearStoredSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.accessToken);
  localStorage.removeItem(STORAGE_KEYS.refreshToken);
  localStorage.removeItem(STORAGE_KEYS.accessTokenExpiresAt);
  localStorage.removeItem(STORAGE_KEYS.refreshTokenExpiresAt);
  localStorage.removeItem(STORAGE_KEYS.user);
}

function persistSession(session: AuthSession) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.accessToken, session.accessToken || session.token);
  localStorage.setItem(STORAGE_KEYS.refreshToken, session.refreshToken);
  localStorage.setItem(STORAGE_KEYS.accessTokenExpiresAt, session.expiresAt);
  localStorage.setItem(STORAGE_KEYS.refreshTokenExpiresAt, session.refreshExpiresAt);
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(session.user));
}

function isDemoToken(token: string) {
  return token === DEMO_ACCESS_TOKEN;
}

function createDemoSession(account: string): AuthSession {
  const now = Date.now();
  const expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
  const refreshExpiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();

  return {
    token: DEMO_ACCESS_TOKEN,
    accessToken: DEMO_ACCESS_TOKEN,
    refreshToken: DEMO_REFRESH_TOKEN,
    expiresIn: 24 * 60 * 60,
    refreshExpiresIn: 7 * 24 * 60 * 60,
    expiresAt,
    refreshExpiresAt,
    user: {
      id: 'demo-admin',
      email: account.trim() || 'demo@local.test',
      name: 'Demo Admin',
      role: 'Executive',
      active: true,
    },
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimeoutRef = useRef<number | null>(null);
  const refreshInFlightRef = useRef<Promise<AuthSession | null> | null>(null);

  const clearRefreshTimer = () => {
    if (refreshTimeoutRef.current) {
      window.clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  };

  const getRefreshToken = () => getStorageItem(STORAGE_KEYS.refreshToken);
  const getAccessToken = () => getStorageItem(STORAGE_KEYS.accessToken);

  const scheduleRefresh = (session?: AuthSession) => {
    if (typeof window === 'undefined') return;
    clearRefreshTimer();

    const refreshToken = session?.refreshToken || getRefreshToken();
    if (!refreshToken) {
      return;
    }

    const token = session?.accessToken || session?.token || getAccessToken();
    const expiryFromSession = session?.expiresAt
      ? getExpiryMsFromIso(session.expiresAt)
      : getExpiryMsFromIso(getStorageItem(STORAGE_KEYS.accessTokenExpiresAt));
    const expiryFromToken = token ? extractExpiryMsFromToken(token) : null;
    const expiryMs = expiryFromSession || expiryFromToken;
    if (!expiryMs) {
      return;
    }

    const now = Date.now();
    const refreshAt = expiryMs - 60 * 1000;
    const delay = Math.max(5000, refreshAt - now);

    refreshTimeoutRef.current = window.setTimeout(() => {
      void refreshSession();
    }, delay);
  };

  const applySession = (session: AuthSession) => {
    persistSession(session);
    setUser(session.user);
    scheduleRefresh(session);
  };

  const refreshSession = async (): Promise<AuthSession | null> => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearStoredSession();
      setUser(null);
      clearRefreshTimer();
      return null;
    }

    const run = (async () => {
      try {
        const session = await refreshTokenApi(refreshToken);
        applySession(session);
        return session;
      } catch (_error) {
        clearStoredSession();
        setUser(null);
        clearRefreshTimer();
        return null;
      } finally {
        refreshInFlightRef.current = null;
      }
    })();

    refreshInFlightRef.current = run;
    return run;
  };

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      const token = getAccessToken();
      const refreshToken = getRefreshToken();

      if (!token && !refreshToken) {
        if (active) setIsLoading(false);
        return;
      }

      if (token) {
        if (isDemoToken(token)) {
          const rawUser = getStorageItem(STORAGE_KEYS.user);
          if (rawUser) {
            try {
              if (active) {
                setUser(JSON.parse(rawUser));
                scheduleRefresh();
                setIsLoading(false);
              }
              return;
            } catch (_error) {
              clearStoredSession();
            }
          }
        }

        try {
          const response = await meApi(token);
          if (active) {
            setUser(response.user);
            localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(response.user));
            scheduleRefresh();
          }
          if (active) setIsLoading(false);
          return;
        } catch (_error) {
          // Fall through to refresh flow.
        }
      }

      if (refreshToken) {
        const refreshed = await refreshSession();
        if (!refreshed && active) {
          setUser(null);
        }
      } else if (active) {
        clearStoredSession();
        setUser(null);
      }

      if (active) {
        setIsLoading(false);
      }
    };

    void restoreSession();
    return () => {
      active = false;
      clearRefreshTimer();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onStorage = (event: StorageEvent) => {
      if (!event.key) return;
      if (!Object.values(STORAGE_KEYS).includes(event.key)) return;

      const token = getAccessToken();
      const rawUser = getStorageItem(STORAGE_KEYS.user);

      if (!token) {
        setUser(null);
        clearRefreshTimer();
        return;
      }

      if (rawUser) {
        try {
          setUser(JSON.parse(rawUser));
          scheduleRefresh();
        } catch (_error) {
          setUser(null);
        }
      }
    };

    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      if (!email.trim() || !password.trim()) {
        await loginApi(email, password);
        return;
      }
      const session = createDemoSession(email);
      applySession(session);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    const refreshToken = getRefreshToken();
    void logoutApi(refreshToken).catch(() => {});
    clearStoredSession();
    clearRefreshTimer();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
