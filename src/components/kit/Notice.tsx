import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'

import { cn } from '@/lib/utils'

import { kitText } from './text'

export type NoticeTone = 'info' | 'warning' | 'success' | 'danger'

const TONE_CLASS: Record<NoticeTone, string> = {
  info: 'border-info-border bg-info-bg text-info-text',
  warning: 'border-warning-border bg-warning-bg text-warning-text',
  success: 'border-success-border bg-success-bg text-success-text',
  danger: 'border-danger-border bg-danger-bg text-danger-text',
}

const TONE_ICON: Record<NoticeTone, ReactNode> = {
  info: <Info />,
  warning: <TriangleAlert />,
  success: <CircleCheck />,
  danger: <CircleAlert />,
}

export interface NoticeProps {
  tone?: NoticeTone
  title: ReactNode
  /** Detaliu sub titlu. */
  children?: ReactNode
  /** Înlocuiește iconița implicită a tonului. */
  icon?: ReactNode
  /** De obicei un buton, sub text. */
  action?: ReactNode
  className?: string
}

/** Bandă de mesaj în pagină (ex. „2 prioritare azi · 21 kg — de livrat cu prioritate”). */
export function Notice({ tone = 'info', title, children, icon, action, className }: NoticeProps) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-box border px-4 py-3', TONE_CLASS[tone], className)}
    >
      <span className="mt-0.5 shrink-0 [&_svg]:size-5" aria-hidden>
        {icon ?? TONE_ICON[tone]}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className={cn('font-bold', kitText.secondary)}>{title}</p>
        {children ? <div className={cn('text-fg', kitText.secondary)}>{children}</div> : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  )
}
