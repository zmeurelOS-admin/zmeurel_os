'use client'

import { AiBottomSheet } from '@/components/ai/AiBottomSheet'
import { useAiPanel } from '@/contexts/AiPanelContext'

export function AiPanel() {
  const { isAiPanelOpen, closeAiPanel } = useAiPanel()

  return (
    <div className="hidden md:block">
      <AiBottomSheet open={isAiPanelOpen} onClose={closeAiPanel} variant="panel" />
    </div>
  )
}
