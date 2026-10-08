import { redirect } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { ScopeProvider } from '@/lib/scope';
import { getProfile, remoteApiHost } from '@/lib/session';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = getProfile();

  // Middleware already redirects without a session; this covers a cookie that
  // exists but cannot be parsed.
  if (!profile) redirect('/login');

  return (
    <ScopeProvider enabled={profile.role === 'super_admin'}>
      <Shell profile={profile} remoteApi={remoteApiHost()}>
        {children}
      </Shell>
    </ScopeProvider>
  );
}
