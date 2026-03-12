'use client'

import { useEffect, useMemo, useState } from 'react'

type DemoFirstRunTutorialProps = {
  open: boolean
  onSkip: () => void
  onFinish: () => void
}

type TutorialStep = {
  id: string
  targetSelector: string
  text: string
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'stats',
    targetSelector: '[data-tutorial="dashboard-stats"]',
    text: 'Aici vezi rapid cât ai recoltat, cât ai vândut și ce ai de livrat.',
  },
  {
    id: 'quick-add',
    targetSelector: '[data-tutorial="quick-add-button"]',
    text: 'Apasă aici ca să adaugi rapid o recoltare, comandă sau cheltuială.',
  },
  {
    id: 'comenzi',
    targetSelector: '[data-tutorial="dashboard-comenzi"]',
    text: 'Aici vezi comenzile de livrat și le poți marca rapid ca livrate.',
  },
]

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function DemoFirstRunTutorial({ open, onSkip, onFinish }: DemoFirstRunTutorialProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const currentStep = TUTORIAL_STEPS[stepIndex]

  useEffect(() => {
    if (!open) {
      setStepIndex(0)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const updateTargetRect = () => {
      const target = document.querySelector(currentStep.targetSelector)
      if (!(target instanceof HTMLElement)) {
        setTargetRect(null)
        return
      }
      setTargetRect(target.getBoundingClientRect())
    }

    updateTargetRect()
    window.addEventListener('resize', updateTargetRect)
    window.addEventListener('scroll', updateTargetRect, true)

    return () => {
      window.removeEventListener('resize', updateTargetRect)
      window.removeEventListener('scroll', updateTargetRect, true)
    }
  }, [currentStep.targetSelector, open])

  const highlightStyle = useMemo(() => {
    if (!targetRect) return null

    const padding = 8
    const top = Math.max(6, targetRect.top - padding)
    const left = Math.max(6, targetRect.left - padding)
    const width = Math.max(40, targetRect.width + padding * 2)
    const height = Math.max(40, targetRect.height + padding * 2)

    return {
      position: 'fixed' as const,
      top,
      left,
      width,
      height,
      borderRadius: 14,
      border: '2px solid rgba(255,255,255,0.98)',
      boxShadow: '0 0 0 9999px rgba(12, 18, 28, 0.45)',
      pointerEvents: 'none' as const,
      zIndex: 100000200,
    }
  }, [targetRect])

  const tooltipStyle = useMemo(() => {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 360
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800
    const cardWidth = Math.min(viewportWidth - 24, 340)
    const headerBottom =
      typeof document !== 'undefined'
        ? (document.querySelector('header') as HTMLElement | null)?.getBoundingClientRect().bottom ?? 0
        : 0
    const minTop = Math.max(12, Math.round(headerBottom + 8))

    if (!targetRect) {
      return {
        position: 'fixed' as const,
        left: clamp((viewportWidth - cardWidth) / 2, 12, Math.max(12, viewportWidth - cardWidth - 12)),
        bottom: 'calc(var(--tabbar-h, 56px) + var(--safe-b, 0px) + 20px)',
        width: cardWidth,
        zIndex: 100000210,
      }
    }

    const centerX = targetRect.left + targetRect.width / 2
    const left = clamp(centerX - cardWidth / 2, 12, Math.max(12, viewportWidth - cardWidth - 12))
    const placeBelow = targetRect.bottom + 160 < viewportHeight
    const top = placeBelow ? Math.max(minTop, targetRect.bottom + 12) : Math.max(minTop, targetRect.top - 132)

    return {
      position: 'fixed' as const,
      left,
      top,
      width: cardWidth,
      zIndex: 100000210,
    }
  }, [targetRect])

  if (!open) return null

  const isLastStep = stepIndex === TUTORIAL_STEPS.length - 1

  const handleNext = () => {
    if (isLastStep) {
      onFinish()
      return
    }
    setStepIndex((current) => current + 1)
  }

  return (
    <>
      {highlightStyle ? (
        <div style={highlightStyle} />
      ) : (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(12, 18, 28, 0.45)',
            zIndex: 100000200,
          }}
        />
      )}

      <div
        style={{
          ...tooltipStyle,
          background: '#FFFFFF',
          borderRadius: 14,
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '0 8px 28px rgba(0, 0, 0, 0.18)',
          padding: 12,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.45,
            color: '#1D2A30',
          }}
        >
          {currentStep.text}
        </p>
        <div
          style={{
            marginTop: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 11, color: '#6A7780' }}>
            Pasul {stepIndex + 1} din {TUTORIAL_STEPS.length}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onSkip}
              style={{
                border: '1px solid #D0D7DE',
                borderRadius: 10,
                background: '#FFFFFF',
                color: '#4B5962',
                fontSize: 12,
                fontWeight: 600,
                padding: '7px 10px',
                cursor: 'pointer',
              }}
            >
              Sari
            </button>
            <button
              type="button"
              onClick={handleNext}
              style={{
                border: 'none',
                borderRadius: 10,
                background: '#2D6A4F',
                color: '#FFFFFF',
                fontSize: 12,
                fontWeight: 700,
                padding: '7px 11px',
                cursor: 'pointer',
              }}
            >
              {isLastStep ? 'Finalizează' : 'Următorul'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
