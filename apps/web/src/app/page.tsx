import Image from 'next/image';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="flex flex-col items-center text-center">
        <Image
          src="/brand/mark.png"
          alt=""
          width={104}
          height={104}
          priority
          aria-hidden="true"
        />
        <h1 className="mt-4 text-4xl font-bold text-indigo-600 sm:text-5xl">TripSync</h1>
        <p className="mt-4 text-lg text-gray-600">
          Plan trips together in real-time with your group.
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <Link
            href="/login"
            className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
