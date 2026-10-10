import { redirect } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { getProfile, remoteApiHost } from '@/lib/session';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = getProfile();

  // Middleware already redirects without a session; this covers a cookie that
  // exists but cannot be parsed.
  if (!profile) redirect('/login');

  // This is the shop dashboard. Sign-in refuses platform accounts, and the
  // middleware drops stale ones; this is the last check before anything renders.
  if (profile.role === 'super_admin' || !profile.organizationId) redirect('/login?platform=1');

  return (
    <Shell profile={profile} remoteApi={remoteApiHost()}>
      {children}
    </Shell>
  );
}
