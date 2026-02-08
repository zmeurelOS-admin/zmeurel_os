'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Parcela {
  id: string
  id_parcela: string
  nume_parcela: string
  suprafata_m2: number
  tip_fruct: string
  soi_plantat: string
  an_plantare: number
  nr_plante: number
  status: string
  observatii: string | null
  created_at: string
}

export default function TestPage() {
  const [parcele, setParcele] = useState<Parcela[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchParcele() {
      try {
        const supabase = createClient()
        
        const { data, error } = await supabase
          .from('parcele')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error

        setParcele(data || [])
      } catch (err) {
        console.error('Error fetching parcele:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchParcele()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F16B6B] mx-auto"></div>
          <p className="mt-4 text-gray-600">Se încarcă parcele...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 font-semibold text-lg mb-2">Eroare conexiune</h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-3xl font-bold text-[#312E3F] mb-2">
            🍓 Zmeurel OS - Test Conexiune
          </h1>
          <p className="text-gray-600 mb-6">
            Verificare conexiune Supabase funcțională!
          </p>

          {parcele.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nu există parcele în baza de date.
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800">
                Parcele găsite: {parcele.length}
              </h2>
              
              {parcele.map((parcela) => (
                <div 
                  key={parcela.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-[#F16B6B] transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="inline-block bg-[#F16B6B] text-white px-2 py-1 rounded text-sm font-semibold">
                        {parcela.id_parcela}
                      </span>
                      <h3 className="text-lg font-semibold text-gray-900 mt-2">
                        {parcela.nume_parcela}
                      </h3>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      parcela.status === 'Activ' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {parcela.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                    <div>
                      <span className="text-gray-500">Tip fruct:</span>
                      <p className="font-medium text-gray-900">{parcela.tip_fruct}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Soi:</span>
                      <p className="font-medium text-gray-900">{parcela.soi_plantat}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Suprafață:</span>
                      <p className="font-medium text-gray-900">{parcela.suprafata_m2} m²</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Nr. plante:</span>
                      <p className="font-medium text-gray-900">{parcela.nr_plante}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">An plantare:</span>
                      <p className="font-medium text-gray-900">{parcela.an_plantare}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Densitate:</span>
                      <p className="font-medium text-gray-900">
                        {(parcela.nr_plante / parcela.suprafata_m2).toFixed(2)} plante/m²
                      </p>
                    </div>
                  </div>

                  {parcela.observatii && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <span className="text-gray-500 text-sm">Observații:</span>
                      <p className="text-gray-700 text-sm mt-1">{parcela.observatii}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>✅ Conexiune Supabase funcțională</span>
              <span>Tenant ID: b68a19a7-c5fc-4f30-94a2-b3c17af68f76</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
