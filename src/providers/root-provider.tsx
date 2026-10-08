'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from 'next-themes';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { ReactNode, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function ThemeSync() {
  const searchParams = useSearchParams();
  const { setTheme } = useTheme();

  useEffect(() => {
    const t = searchParams.get('theme');
    if (t === 'light' || t === 'dark' || t === 'system') {
      setTheme(t);
    }
  }, [searchParams, setTheme]);

  return null;
}

interface RootProviderProps {
  children: ReactNode;
}

export function RootProvider({ children }: RootProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <Suspense fallback={null}>
          <ThemeSync />
        </Suspense>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
