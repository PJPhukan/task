import * as React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: 'default' | 'outline' | 'secondary';
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  children?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  children,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center rounded-lg border border-dashed border-border/80 bg-card/30 p-8 sm:p-12 transition-colors',
        compact && 'p-4 sm:p-6 border-transparent bg-transparent',
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground ring-1 ring-border/50 mb-3.5">
        <Icon className="h-5 w-5" />
      </div>

      <h3 className="text-sm font-semibold text-foreground tracking-tight">
        {title}
      </h3>

      {description && (
        <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-sm leading-relaxed">
          {description}
        </p>
      )}

      {action && (
        <div className="mt-5">
          {action.href ? (
            <Button
              variant={action.variant || 'default'}
              size="sm"
              nativeButton={false}
              render={
                <Link href={action.href}>
                  {action.label}
                </Link>
              }
            />
          ) : (
            <Button
              variant={action.variant || 'default'}
              size="sm"
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
        </div>
      )}

      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
