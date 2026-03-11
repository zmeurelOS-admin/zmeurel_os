'use client'

import { useState } from 'react'
import { Search, ClipboardList, Droplets, Scissors, Bug, Sprout, ArrowRight } from 'lucide-react'
import { AddActivitateAgricolaDialog } from '@/components/activitati-agricole/AddActivitateAgricolaDialog'

export default function ActivitatiPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)

  const categorii = [
    { name: 'Tratamente', icon: Bug, color: '#EF4444', bg: '#FEF2F2' },
    { name: 'Irigare', icon: Droplets, color: '#3B82F6', bg: '#EFF6FF' },
    { name: 'Tăieri', icon: Scissors, color: '#F59E0B', bg: '#FFFBEB' },
    { name: 'Fertilizare', icon: Sprout, color: '#10B981', bg: '#ECFDF5' },
  ]

  return (
    <div
      style={{
        backgroundColor: '#F8F9FB',
        width: '100%',
        minHeight: '100%',
        paddingBottom: 20,
        overflowX: 'hidden',
        fontFamily: 'inherit',
      }}
    >
      <div style={{ marginLeft: -16, marginRight: -16 }}>
        <div
          style={{
            background: 'linear-gradient(135deg, #064E3B 0%, #065F46 100%)',
            padding: '60px 24px 80px 24px',
            borderBottomLeftRadius: 45,
            borderBottomRightRadius: 45,
            boxShadow: '0 10px 30px rgba(6, 78, 59, 0.15)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, color: 'white' }}>
                Operațiuni
              </h1>
              <p style={{ opacity: 0.8, fontSize: 14, marginTop: 4, color: '#ECFDF5' }}>
                Planifică și monitorizează cultura.
              </p>
            </div>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.15)', padding: 10, borderRadius: 18 }}>
              <ClipboardList color="white" size={24} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px', marginTop: -30 }}>
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            padding: '12px 16px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
            border: '1px solid #eee',
          }}
        >
          <Search size={18} color="#94a3b8" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Caută o intervenție..."
            style={{
              border: 'none',
              outline: 'none',
              marginLeft: 12,
              width: '100%',
              fontSize: 16,
              fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      <div style={{ padding: '24px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 32 }}>
          {categorii.map((cat) => (
            <div key={cat.name} style={{ textAlign: 'center' }}>
              <div
                style={{
                  backgroundColor: cat.bg,
                  width: '100%',
                  aspectRatio: '1/1',
                  borderRadius: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 6,
                }}
              >
                <cat.icon size={22} color={cat.color} />
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: '#64748b',
                  textTransform: 'uppercase',
                }}
              >
                {cat.name}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>Istoric Lucrări</h2>
          <ArrowRight size={20} color="#94a3b8" />
        </div>

        <div
          style={{
            backgroundColor: 'white',
            padding: 20,
            borderRadius: 24,
            border: '1px solid #eee',
          }}
        >
          Exemplu activitate...
        </div>
      </div>
      <AddActivitateAgricolaDialog open={addOpen} onOpenChange={setAddOpen} hideTrigger />
    </div>
  )
}

