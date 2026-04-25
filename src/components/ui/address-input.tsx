'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Suggestion {
  value: string
}

interface AddressInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function AddressInput({ value, onChange, placeholder, className }: AddressInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function fetchSuggestions(query: string) {
    if (query.length < 3) { setSuggestions([]); setOpen(false); return }
    try {
      const res = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Token ${process.env.NEXT_PUBLIC_DADATA_TOKEN}`,
        },
        body: JSON.stringify({ query, count: 6, locations: [{ city: 'Казань' }] }),
      })
      const data = await res.json()
      const list = data.suggestions || []
      setSuggestions(list)
      if (list.length > 0 && inputRef.current) {
        setRect(inputRef.current.getBoundingClientRect())
        setOpen(true)
      } else {
        setOpen(false)
      }
    } catch {
      setSuggestions([])
      setOpen(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    onChange(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300)
  }

  function handleSelect(s: Suggestion) {
    onChange(s.value)
    setOpen(false)
    setSuggestions([])
  }

  return (
    <>
      <Input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={className}
      />
      {open && suggestions.length > 0 && rect && (
        <div
          style={{
            position: 'fixed',
            top: rect.bottom + 4,
            left: rect.left,
            width: rect.width,
            zIndex: 9999,
          }}
          className="bg-background border rounded-lg shadow-xl overflow-hidden"
        >
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className={cn(
                'w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors',
                i !== suggestions.length - 1 && 'border-b'
              )}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(s) }}
            >
              {s.value}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
