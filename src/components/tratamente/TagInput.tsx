'use client'

import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'

import { Input } from '@/components/ui/input'

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  id?: string
}

export function TagInput({ value, onChange, placeholder = 'Adaugă cultură...', id }: TagInputProps) {
  const [inputVal, setInputVal] = useState('')

  const addTag = () => {
    const tag = inputVal.trim().toLowerCase()
    if (!tag || value.includes(tag)) {
      setInputVal('')
      return
    }
    onChange([...value, tag])
    setInputVal('')
  }

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    } else if (e.key === 'Backspace' && !inputVal && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          id={id}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="agri-control h-11 flex-1"
        />
        <button
          type="button"
          onClick={addTag}
          className="h-11 rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] px-3 text-sm font-medium text-[var(--agri-text)] transition hover:bg-[var(--agri-primary)] hover:text-white"
        >
          + Adaugă
        </button>
      </div>
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--agri-text)]"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[var(--agri-text-muted)] transition hover:text-[var(--soft-danger-text)]"
                aria-label={`Șterge ${tag}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
