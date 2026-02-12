import { Providers } from './providers';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <div className="min-h-screen bg-gray-50">
        {/* Header cu navigare - va fi extins mai târziu */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🍓</span>
                <h1 className="text-xl font-bold text-gray-900">Zmeurel OS</h1>
              </div>
              
              {/* Navigation placeholder */}
              <nav className="flex gap-4">
                <a href="/parcele" className="text-gray-600 hover:text-gray-900">
                  Parcele
                </a>
                {/* Vor fi adăugate: Recoltări, Vânzări, Dashboard */}
              </nav>
            </div>
          </div>
        </header>

        {/* Content */}
        <main>{children}</main>
      </div>
    </Providers>
  );
}
