'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

type AiPanelContextValue = {
  isAiPanelOpen: boolean
  openAiPanel: () => void
  closeAiPanel: () => void
  setAiPanelOpen: (open: boolean) => void
}

const AiPanelContext = createContext<AiPanelContextValue | null>(null)

export function AiPanelProvider({ children }: { children: ReactNode }) {
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false)

  const value = useMemo<AiPanelContextValue>(
    () => ({
      isAiPanelOpen,
      openAiPanel: () => setIsAiPanelOpen(true),
      closeAiPanel: () => setIsAiPanelOpen(false),
      setAiPanelOpen: setIsAiPanelOpen,
    }),
    [isAiPanelOpen]
  )

  return <AiPanelContext.Provider value={value}>{children}</AiPanelContext.Provider>
}

export function useAiPanel() {
  const context = useContext(AiPanelContext)
  if (!context) {
    throw new Error('useAiPanel must be used within AiPanelProvider')
  }

  return context
}
