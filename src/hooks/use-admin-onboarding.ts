'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useCurrentUser } from './use-current-user';
import { apiClient } from '@/lib/api-client';

export function useAdminOnboarding() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, roles, isLoading } = useCurrentUser();

  React.useEffect(() => {
    if (isLoading || !user) return;
    if (pathname.startsWith('/setup') || pathname.startsWith('/sign-')) return;

    const isAdmin = roles.some((r) => r.id === 'admin' || r.displayName.toLowerCase() === 'admin');
    if (!isAdmin) return;

    if (typeof window === 'undefined') return;
    if (localStorage.getItem('rolane_setup_completed')) return;
    if (sessionStorage.getItem('rolane_admin_setup_checked')) return;

    sessionStorage.setItem('rolane_admin_setup_checked', 'true');

    // Check if admin has any non-personal projects with boards
    apiClient
      .get<{ projects: any[] }>('/api/projects')
      .then(async (res) => {
        const teamProjects = (res.projects || []).filter((p) => !p.isPersonal);
        if (teamProjects.length === 0) {
          router.push('/setup?step=project');
          return;
        }

        let totalBoards = 0;
        await Promise.all(
          teamProjects.map(async (p) => {
            try {
              const bRes = await apiClient.get<{ boards: any[] }>(
                `/api/projects/${p.id}/boards`
              );
              totalBoards += (bRes.boards || []).length;
            } catch {
              // Ignore
            }
          })
        );

        if (totalBoards === 0) {
          router.push('/setup?step=project');
        } else {
          localStorage.setItem('rolane_setup_completed', 'true');
        }
      })
      .catch(() => {});
  }, [user, roles, isLoading, pathname, router]);
}
