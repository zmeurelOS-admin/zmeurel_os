'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { usePushSubscription } from '@/components/notifications/usePushSubscription'
import { prepareClientBeforeServerSignOut } from '@/lib/auth/server-sign-out-form'

interface MoreMenuProps {
  open: boolean
  onClose: () => void
}

type SectionItem = {
  emoji: string
  title: string
  description: string
  href: string
  admin?: boolean
}

type Section = {
  label: string
  items: SectionItem[]
  adminSection?: boolean
}

const SECTIONS: Section[] = [
  {
    label: 'Operațiuni',
    items: [
      { emoji: '🌿', title: 'Terenuri', description: 'Parcele, solarii, livezi', href: '/parcele' },
      { emoji: '💰', title: 'Vânzări', description: 'Istoric livrări și încasări', href: '/vanzari' },
      { emoji: '📉', title: 'Cheltuieli', description: 'Costuri și categorii', href: '/cheltuieli' },
      { emoji: '🏗️', title: 'Investiții', description: 'Capitalizări și achiziții', href: '/investitii' },
      { emoji: '📦', title: 'Stocuri', description: 'Disponibil pe locații', href: '/stocuri' },
      { emoji: '🌱', title: 'Material săditor', description: 'Butași și vânzări', href: '/vanzari-butasi' },
    ],
  },
  {
    label: 'Administrare',
    items: [
      { emoji: '🤝', title: 'Clienți', description: 'Contacte și istoric', href: '/clienti' },
      { emoji: '👤', title: 'Culegători', description: 'Echipa și performanță', href: '/culegatori' },
      { emoji: '📋', title: 'Rapoarte', description: 'Producție, financiar, export', href: '/rapoarte' },
    ],
  },
]

const ADMIN_SECTION: Section = {
  label: 'Admin',
  adminSection: true,
  items: [
    { emoji: '📊', title: 'Analytics', description: 'Statistici globale', href: '/admin/analytics' },
    { emoji: '🏢', title: 'Tenanți', description: 'Lista conturilor', href: '/admin' },
  ],
}

const CONT_ITEMS = [
  { emoji: '⚙️', title: 'Setări', description: 'Profil și preferințe', href: '/settings' },
]

export function MoreMenu({ open, onClose }: MoreMenuProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { isSuperAdmin } = useDashboardAuth()
  const { unsubscribe: unsubscribePush } = usePushSubscription()
  const submittingRef = useRef(false)

  // Manage data-modal-open for mobile FAB / overlays
  useEffect(() => {
    if (open) {
      document.documentElement.setAttribute('data-modal-open', 'true')
    } else {
      document.documentElement.removeAttribute('data-modal-open')
    }
    return () => {
      document.documentElement.removeAttribute('data-modal-open')
    }
  }, [open])

  if (!open) return null

  const sections = isSuperAdmin ? [...SECTIONS, ADMIN_SECTION] : SECTIONS

  const handleNavigate = (href: string) => {
    onClose()
    window.setTimeout(() => router.push(href), 0)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: 'rgba(0,0,0,0.35)',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onClose}
      aria-label="Închide meniu"
    >
      {/* Sheet — stopPropagation prevents overlay click from bubbling */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          margin: '0 auto',
          width: '100%',
          maxWidth: 430,
          maxHeight: '80vh',
          overflowY: 'auto',
          background: 'var(--surface-elevated)',
          border: '1px solid var(--agri-border)',
          borderRadius: '20px 20px 0 0',
          animation: 'moreSheetUp 0.3s cubic-bezier(0.34,1.3,0.64,1) forwards',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--text-hint)' }} />
        </div>

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 20px 12px',
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--agri-text)' }}>Mai mult</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Închide"
            style={{ fontSize: 18, color: 'var(--text-hint)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            ✕
          </button>
        </div>

        {/* Sections */}
        <div style={{ padding: '0 20px 24px' }}>
          {sections.map((section) => (
            <div key={section.label} style={{ marginBottom: 18 }}>
              {/* Section label */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--text-hint)',
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                  }}
                >
                  {section.label}
                </span>
                {section.adminSection && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: 'var(--status-danger-text)',
                      background: 'var(--status-danger-bg)',
                      border: '1px solid var(--status-danger-border)',
                      padding: '2px 8px',
                      borderRadius: 20,
                    }}
                  >
                    ADMIN
                  </span>
                )}
              </div>

              {/* Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {section.items.map((item) => (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => handleNavigate(item.href)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px',
                      borderRadius: 12,
                      cursor: 'pointer',
                      background: 'var(--agri-surface)',
                      border: '1px solid var(--agri-border)',
                      textAlign: 'left',
                      width: '100%',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--agri-surface-muted)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--agri-surface)' }}
                  >
                    {/* Icon */}
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        background: section.adminSection ? 'var(--status-danger-bg)' : 'var(--agri-surface-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 22,
                        flexShrink: 0,
                      }}
                    >
                      {item.emoji}
                    </div>

                    {/* Text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--agri-text)', lineHeight: 1.3 }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--agri-text-muted)', lineHeight: 1.4 }}>
                        {item.description}
                      </div>
                    </div>

                    {/* Arrow */}
                    <span style={{ fontSize: 12, color: 'var(--text-hint)', flexShrink: 0 }}>›</span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Cont & Setări */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ marginBottom: 8 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--text-hint)',
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                }}
              >
                Cont
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {CONT_ITEMS.map((item) => (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => handleNavigate(item.href)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    background: 'var(--agri-surface)',
                    border: '1px solid var(--agri-border)',
                    textAlign: 'left',
                    width: '100%',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--agri-surface-muted)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--agri-surface)' }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      background: 'var(--agri-surface-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 22,
                      flexShrink: 0,
                    }}
                  >
                    {item.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--agri-text)', lineHeight: 1.3 }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--agri-text-muted)', lineHeight: 1.4 }}>{item.description}</div>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-hint)', flexShrink: 0 }}>›</span>
                </button>
              ))}

              {/* Deconectare — POST /api/auth/sign-out (același flux ca LogoutButton) */}
              <form
                action="/api/auth/sign-out"
                method="POST"
                onSubmit={async (event) => {
                  if (submittingRef.current) return
                  submittingRef.current = true
                  event.preventDefault()
                  const form = event.currentTarget
                  onClose()
                  await prepareClientBeforeServerSignOut(queryClient, { unsubscribePush })
                  form.submit()
                }}
                style={{ width: '100%' }}
              >
                <button
                  type="submit"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    background: 'var(--status-danger-bg)',
                    border: '1px solid var(--status-danger-border)',
                    textAlign: 'left',
                    width: '100%',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'color-mix(in srgb, var(--status-danger-bg) 82%, var(--surface-elevated-hover))' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--status-danger-bg)' }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      background: 'var(--status-danger-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 22,
                      flexShrink: 0,
                    }}
                  >
                    🚪
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--status-danger-text)', lineHeight: 1.3 }}>
                      Deconectare
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-hint)', lineHeight: 1.4 }}>Ieși din cont</div>
                  </div>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
