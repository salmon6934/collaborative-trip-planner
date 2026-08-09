export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-indigo-600">Trip Planner</h1>
          <p className="mt-2 text-gray-600">Plan trips together in real-time</p>
        </div>
        {children}
      </div>
    </div>
  );
}
