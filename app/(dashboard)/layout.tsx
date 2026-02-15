// src/app/(dashboard)/layout.tsx
import { Providers } from './providers';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Providers>
        {/* Header/Navigation - poate fi adăugat aici mai târziu */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="container mx-auto px-6 py-4">
            <h1 className="text-2xl font-bold" style={{ color: '#312E3F' }}>
              🍓 Zmeurel OS
            </h1>
          </div>
        </header>

        {/* Main content */}
        <main>{children}</main>
      </Providers>
    </div>
  );
}
