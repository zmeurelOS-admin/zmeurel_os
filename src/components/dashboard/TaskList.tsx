import { Check, CheckCheck } from 'lucide-react'

import { DashboardCard } from '@/components/dashboard/DashboardCard'
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
  if (tone === 'urgent') {
    return {
      icon: 'bg-[rgba(207,34,46,0.08)] text-[#CF222E]',
      badge: 'border-[rgba(207,34,46,0.1)] bg-[rgba(207,34,46,0.05)] text-[#CF222E]',
    }
  }

  if (tone === 'warning') {
    return {
      icon: 'bg-[rgba(179,90,0,0.08)] text-[#B35A00]',
      badge: 'border-[rgba(179,90,0,0.1)] bg-[rgba(179,90,0,0.06)] text-[#B35A00]',
    }
  }

  return {
    icon: 'bg-[rgba(24,104,219,0.08)] text-[#1868DB]',
    badge: 'border-[rgba(24,104,219,0.1)] bg-[rgba(24,104,219,0.06)] text-[#1868DB]',
  }
}

export function TaskList({
  tasks,
  loading = false,
  title = 'Task-uri azi',
}: {
  tasks: DashboardTaskItem[]
  loading?: boolean
  title?: string
}) {
  if (loading) {
    return (
      <DashboardCard title={title} className="shadow-sm" contentClassName="space-y-3">
        <div className="space-y-3 animate-pulse">
          <div className="h-20 rounded-[22px] bg-[var(--agri-surface-muted)]" />
          <div className="h-20 rounded-[22px] bg-[var(--agri-surface-muted)]" />
        </div>
      </DashboardCard>
    )
  }

  if (tasks.length === 0) {
    return (
      <DashboardCard title={title} className="shadow-sm" contentClassName="space-y-3">
        <div className="rounded-[22px] border border-[rgba(13,155,92,0.1)] bg-[rgba(13,155,92,0.06)] px-5 py-5 text-[#0D9B5C] shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/70 shadow-sm">
              <CheckCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">✓ Totul e la zi</div>
              <div className="mt-1 text-xs text-[color:rgba(13,155,92,0.86)]">Nu ai alerte operaționale generate din datele curente.</div>
            </div>
          </div>
        </div>
      </DashboardCard>
    )
  }

  return (
    <DashboardCard title={title} className="shadow-sm" contentClassName="space-y-3">
      {tasks.map((task) => {
        const tones = toneClasses(task.tone)
        return (
          <div
            key={task.id}
            className="flex items-center gap-3 rounded-[22px] bg-[var(--agri-surface)] px-4 py-4 shadow-sm transition duration-150 active:scale-[0.985]"
          >
            <div className={cn('flex h-[42px] w-[42px] items-center justify-center rounded-xl text-lg shadow-sm', tones.icon)}>
              <span aria-hidden="true">{task.icon}</span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-[var(--agri-text)]">{task.text}</div>
            </div>

            <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-semibold', tones.badge)}>
              {task.tag}
            </span>

            <button
              type="button"
              aria-label={`Bifează task ${task.text}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] text-[var(--agri-text-muted)] shadow-sm transition duration-150 active:scale-[0.985]"
            >
              <Check className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </DashboardCard>
  )
}
