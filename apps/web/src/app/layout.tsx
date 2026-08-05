import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Collaborative Trip Planner',
  description: 'Plan trips together in real-time',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
