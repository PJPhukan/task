'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  User,
  Shield,
  FolderKanban,
  LayoutGrid,
  Mail,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

interface UserProfilePageProps {
  params: Promise<{ userId: string }>;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarPublicId?: string | null;
  isActive: boolean;
  roles: Array<{ id: string; displayName: string }>;
  permissions: string[];
  projects: Array<{ id: string; name: string; key: string }>;
  boards: Array<{ id: string; name: string; projectId: string }>;
}

export default function UserProfilePage(props: UserProfilePageProps) {
  const { userId } = React.use(props.params);
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    setIsLoading(true);
    setErrorMessage(null);
    apiClient
      .get<{ profile: UserProfile }>(`/api/users/${userId}/profile`)
      .then((res) => setProfile(res.profile))
      .catch((err) => {
        if (err instanceof ApiError) {
          setErrorMessage(err.message);
        } else {
          setErrorMessage('Failed to load user profile.');
        }
      })
      .finally(() => setIsLoading(false));
  }, [userId]);

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40 rounded-sm" />
          <Skeleton className="h-40 rounded-sm" />
        </div>
      </div>
    );
  }

  if (errorMessage || !profile) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-sm text-destructive">{errorMessage || 'User not found.'}</p>
        <Link href="/users">
          <Button variant="outline" size="sm">Back to users</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <Link href="/users">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to users</span>
          </Button>
        </Link>
      </div>

      {/* User Header Card */}
      <div className="p-6 border border-border rounded-sm bg-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar size="lg" className="h-16 w-16">
              <AvatarFallback className="text-lg font-semibold bg-brand/10 text-brand">
                {getInitials(profile.name)}
              </AvatarFallback>
            </Avatar>

            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-semibold tracking-tight text-foreground">
                  {profile.name}
                </h1>
                {profile.isActive ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 rounded-sm"
                  >
                    Active
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="text-[10px] text-muted-foreground bg-muted/70 rounded-sm"
                  >
                    Inactive
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                <span>{profile.email}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Roles section */}
        <div className="pt-4 border-t border-border/70 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Roles ({profile.roles.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {profile.roles.length === 0 ? (
              <span className="text-xs text-muted-foreground italic">No roles assigned</span>
            ) : (
              profile.roles.map((r) => (
                <Badge
                  key={r.id}
                  variant="secondary"
                  className="text-xs font-medium rounded-sm px-2 py-0.5"
                >
                  {r.displayName}
                </Badge>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Projects and Boards Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Projects */}
        <div className="p-5 border border-border rounded-sm bg-card space-y-3">
          <div className="flex items-center justify-between border-b border-border/70 pb-3">
            <div className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-brand" />
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Projects
              </h2>
            </div>
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {profile.projects.length}
            </span>
          </div>

          {profile.projects.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-3">
              Not a member of any projects.
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {profile.projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between py-2.5 hover:text-brand transition-colors text-xs group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-foreground group-hover:text-brand truncate">
                      {p.name}
                    </span>
                    <Badge variant="secondary" className="font-mono text-[10px] rounded-sm">
                      {p.key}
                    </Badge>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Boards they can open */}
        <div className="p-5 border border-border rounded-sm bg-card space-y-3">
          <div className="flex items-center justify-between border-b border-border/70 pb-3">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-brand" />
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Boards they can open
              </h2>
            </div>
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {profile.boards.length}
            </span>
          </div>

          {profile.boards.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-3">
              No accessible boards in assigned projects.
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {profile.boards.map((b) => (
                <Link
                  key={b.id}
                  href={`/projects/${b.projectId}/boards/${b.id}`}
                  className="flex items-center justify-between py-2.5 hover:text-brand transition-colors text-xs group"
                >
                  <span className="font-medium text-foreground group-hover:text-brand truncate">
                    {b.name}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
