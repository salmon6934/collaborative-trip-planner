import Image from 'next/image';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-secondary-tint px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/brand/mark.png"
            alt=""
            width={72}
            height={72}
            priority
            aria-hidden="true"
          />
          <h1 className="mt-3 text-3xl font-bold text-primary">TripSync</h1>
          <p className="mt-2 text-muted-foreground">Plan trips together in real-time</p>
        </div>
        {children}
      </div>
    </div>
  );
}
