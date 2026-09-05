import { Logo } from '@/components/Logo';
import { NotificationBell } from '@/components/NotificationBell';
import { UserMenu } from '@/components/UserMenu';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="border-b border-border bg-card shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo href="/dashboard" size={32} subtitle="Trips" />
          <div className="flex items-center gap-3">
            <NotificationBell />
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
