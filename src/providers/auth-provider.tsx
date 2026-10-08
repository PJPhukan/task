'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { authClient } from '@/lib/auth-client';
import type { User, UserRole, MeResponse, PermissionKey } from '@/types/auth';

interface AuthContextValue {
  user: User | null;
  roles: UserRole[];
  permissions: string[];
  isLoading: boolean;
  isAuthenticated: boolean;
  can: (_permission: PermissionKey | string) => boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = React.useState<User | null>(null);
  const [roles, setRoles] = React.useState<UserRole[]>([]);
  const [permissions, setPermissions] = React.useState<string[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchCurrentUser = React.useCallback(async () => {
    try {
      const data = await apiClient.get<MeResponse>('/api/me');
      if (data?.user) {
        setUser(data.user);
        setRoles(data.roles || []);
        setPermissions(data.permissions || []);
      } else {
        setUser(null);
        setRoles([]);
        setPermissions([]);
      }
    } catch {
      setUser(null);
      setRoles([]);
      setPermissions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  // Route protection
  React.useEffect(() => {
    if (isLoading) return;

    const isPublicAuthPage =
      pathname.startsWith('/sign-in') ||
      pathname.startsWith('/sign-up') ||
      pathname.startsWith('/forgot-password') ||
      pathname.startsWith('/reset-password') ||
      pathname.startsWith('/check-email') ||
      pathname.startsWith('/email-verified') ||
      pathname.startsWith('/accept-invite');

    const isStatusPage =
      pathname.startsWith('/waiting-for-approval') ||
      pathname.startsWith('/not-approved');

    if (!user) {
      // Unauthenticated user trying to access app pages
      if (!isPublicAuthPage && !isStatusPage) {
        router.push(`/sign-in?returnTo=${encodeURIComponent(pathname)}`);
      }
    } else {
      // User is authenticated
      if (user.status === 'PENDING' && pathname !== '/waiting-for-approval') {
        router.push('/waiting-for-approval');
      } else if (user.status === 'REJECTED' && pathname !== '/not-approved') {
        router.push('/not-approved');
      } else if (user.status === 'ACTIVE' && isPublicAuthPage) {
        // Active user trying to visit sign-in/sign-up
        router.push('/my-tasks');
      }
    }
  }, [user, isLoading, pathname, router]);

  const can = React.useCallback(
    (permission: PermissionKey | string) => {
      if (!user) return false;
      return permissions.includes(permission);
    },
    [user, permissions]
  );

  const handleSignOut = React.useCallback(async () => {
    try {
      await authClient.signOut();
    } catch {
      // Ignore client sign out errors
    }
    setUser(null);
    setRoles([]);
    setPermissions([]);
    router.push('/sign-in');
    router.refresh();
  }, [router]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      roles,
      permissions,
      isLoading,
      isAuthenticated: !!user && user.status === 'ACTIVE',
      can,
      signOut: handleSignOut,
      refresh: fetchCurrentUser,
    }),
    [user, roles, permissions, isLoading, can, handleSignOut, fetchCurrentUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useCurrentUser() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useCurrentUser must be used within an AuthProvider');
  }
  return context;
}
