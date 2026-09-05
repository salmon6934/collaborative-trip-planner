import Image from 'next/image';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background to-secondary-tint px-4">
      <div className="flex flex-col items-center text-center">
        <Image
          src="/brand/mark.png"
          alt=""
          width={104}
          height={104}
          priority
          aria-hidden="true"
        />
        <h1 className="mt-4 text-4xl font-bold text-primary sm:text-5xl">TripSync</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Plan trips together in real-time with your group.
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <Link
            href="/login"
            className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-primary-hover"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg border border-border bg-card px-6 py-3 text-sm font-medium text-foreground shadow-sm hover:bg-muted"
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
