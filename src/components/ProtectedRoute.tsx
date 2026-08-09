'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/lib/TenantProvider';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { userId, isLoading } = useTenant();

  useEffect(() => {
    if (!isLoading && !userId) {
      router.replace('/login');
    }
  }, [isLoading, userId, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center justify-center gap-4">
          <Loader2 className="animate-spin text-primary" size={48} />
          <p className="text-slate-500 font-bold text-sm">Validando acesso...</p>
        </div>
      </div>
    );
  }

  if (!userId) {
    return null;
  }

  return <>{children}</>;
}
