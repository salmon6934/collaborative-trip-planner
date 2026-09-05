'use client';

import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      {/*
       * DECISION: real-time events keep using ephemeral sonner toasts rather
       * than a persistent inline banner. A true "pinned live-activity strip"
       * would need to subscribe to socket/activity-feed events and manage its
       * own state — that's logic, out of scope for this token pass. Instead the
       * toast is restyled to match the Wayfarer banner look: a warm card pill
       * pinned top-center with the primary accent, so it reads like the
       * reference's inline banner while staying ephemeral.
       */}
      <Toaster
        position="top-center"
        closeButton
        toastOptions={{
          classNames: {
            toast:
              'rounded-2xl border border-border bg-card text-foreground shadow-md',
            title: 'font-medium text-foreground',
            description: 'text-muted-foreground',
            actionButton: 'rounded-full bg-primary text-primary-foreground',
            cancelButton: 'rounded-full bg-muted text-muted-foreground',
            closeButton: 'border-border bg-card text-muted-foreground',
            success: 'text-success-tint-foreground',
            error: 'text-danger-tint-foreground',
            warning: 'text-warning-tint-foreground',
          },
        }}
      />
    </SessionProvider>
  );
}
