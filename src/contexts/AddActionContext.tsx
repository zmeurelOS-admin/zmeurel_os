'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

type AddCallback = () => void

type AddActionContextValue = {
  registerAddAction: (callback: AddCallback, label?: string) => () => void
  triggerAddAction: () => boolean
  currentLabel: string
  hasAction: boolean
}

const DEFAULT_LABEL = 'Adaugă recoltare'

const AddActionContext = createContext<AddActionContextValue | null>(null)

export function AddActionProvider({ children }: { children: ReactNode }) {
  const callbackRef = useRef<AddCallback | null>(null)
  const [currentLabel, setCurrentLabel] = useState(DEFAULT_LABEL)
  const [hasAction, setHasAction] = useState(false)

  const registerAddAction = useCallback((callback: AddCallback, label?: string) => {
    callbackRef.current = callback
    setCurrentLabel(label ?? DEFAULT_LABEL)
    setHasAction(true)

    return () => {
      if (callbackRef.current === callback) {
        callbackRef.current = null
        setCurrentLabel(DEFAULT_LABEL)
        setHasAction(false)
      }
    }
  }, [])

  const triggerAddAction = useCallback(() => {
    if (!callbackRef.current) return false
    callbackRef.current()
    return true
  }, [])

  const value = useMemo<AddActionContextValue>(
    () => ({
      registerAddAction,
      triggerAddAction,
      currentLabel,
      hasAction,
    }),
    [currentLabel, hasAction, registerAddAction, triggerAddAction]
  )

  return <AddActionContext.Provider value={value}>{children}</AddActionContext.Provider>
}

export function useAddAction() {
  const context = useContext(AddActionContext)
  if (!context) {
    throw new Error('useAddAction must be used inside AddActionProvider')
  }
  return context
}
