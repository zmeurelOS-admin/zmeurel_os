// src/app/(dashboard)/dashboard/page.tsx
export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-gray-900">
          🍓 Bun venit în Zmeurel OS!
        </h1>
        <p className="mt-2 text-lg text-gray-600">
          Dashboard funcțional - Navigare activă!
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">Module Active</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">9</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">Status MVP</div>
          <div className="text-3xl font-bold text-green-600 mt-2">100%</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">Sidebar</div>
          <div className="text-xl font-bold text-[#F16B6B] mt-2">✅ Works!</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">Next Step</div>
          <div className="text-xl font-bold text-blue-600 mt-2">Deploy 🚀</div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">✅ NAVIGARE FUNCȚIONALĂ!</h3>
        <p className="text-sm text-blue-800">
          Folosește sidebar-ul din stânga pentru a naviga între cele 9 module!
        </p>
      </div>
    </div>
  );
}
