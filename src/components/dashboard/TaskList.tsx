import { Check, CheckCheck } from 'lucide-react'

import { DashboardCard } from '@/components/dashboard/DashboardCard'
import { getStatusToneTokens, type StatusTone } from '@/lib/ui/theme'
import { cn } from '@/lib/utils'

export type DashboardTaskTone = 'urgent' | 'warning' | 'info'

export interface DashboardTaskItem {
  id: string
  icon: string
  text: string
  tag: string
  tone: DashboardTaskTone
}

function toneClasses(tone: DashboardTaskTone) {
  const toneName: StatusTone = tone === 'urgent' ? 'danger' : tone === 'warning' ? 'warning' : 'info'
  const tokens = getStatusToneTokens(toneName)
  if (tone === 'urgent') {
    return {
      icon: `bg-[var(${tokens.bg})] text-[var(${tokens.text})]`,
      badge: `border-[var(${tokens.border})] bg-[var(${tokens.bg})] text-[var(${tokens.text})]`,
    }
  }

  if (tone === 'warning') {
    return {
      icon: `bg-[var(${tokens.bg})] text-[var(${tokens.text})]`,
      badge: `border-[var(${tokens.border})] bg-[var(${tokens.bg})] text-[var(${tokens.text})]`,
    }
  }

  return {
    icon: `bg-[var(${tokens.bg})] text-[var(${tokens.text})]`,
    badge: `border-[var(${tokens.border})] bg-[var(${tokens.bg})] text-[var(${tokens.text})]`,
  }
}

export function TaskList({
  tasks,
  loading = false,
  title = 'Task-uri azi',
  className,
}: {
  tasks: DashboardTaskItem[]
  loading?: boolean
  title?: string
  className?: string
}) {
  if (loading) {
    return (
      <DashboardCard title={title} className={cn('shadow-[var(--shadow-soft)]', className)} contentClassName="space-y-3">
        <div className="space-y-3 animate-pulse">
          <div className="h-20 rounded-[22px] bg-[var(--surface-card-muted)]" />
          <div className="h-20 rounded-[22px] bg-[var(--surface-card-muted)]" />
        </div>
      </DashboardCard>
    )
  }

  if (tasks.length === 0) {
    return (
      <DashboardCard title={title} className={cn('shadow-[var(--shadow-soft)]', className)} contentClassName="space-y-3">
        <div className="px-1 py-2 text-[var(--success-text)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--success-border)] bg-[var(--success-bg)]">
              <CheckCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">✓ Totul e la zi</div>
              <div className="mt-1 text-xs text-[var(--success-text)]">Nu ai alerte operaționale generate din datele curente.</div>
            </div>
          </div>
        </div>
      </DashboardCard>
    )
  }

  return (
    <DashboardCard title={title} className={cn('shadow-[var(--shadow-soft)]', className)} contentClassName="space-y-3">
      {tasks.map((task) => {
        const tones = toneClasses(task.tone)
        return (
          <div
            key={task.id}
            className="flex items-center gap-3 border-b border-[var(--divider)] px-1 py-3 transition duration-150 active:scale-[0.985] last:border-b-0"
          >
            <div className={cn('flex h-[42px] w-[42px] items-center justify-center rounded-xl text-lg', tones.icon)}>
              <span aria-hidden="true">{task.icon}</span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-[14px] leading-5 text-[var(--text-primary)] [font-weight:650]">{task.text}</div>
            </div>

            <span className={cn('rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wide', tones.badge)}>
              {task.tag}
            </span>

            <button
              type="button"
              aria-label={`Bifează task ${task.text}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--surface-card-muted)] text-[var(--text-secondary)] transition duration-150 active:scale-[0.985]"
            >
              <Check className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </DashboardCard>
  )
}
