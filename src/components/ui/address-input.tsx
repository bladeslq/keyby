'use client'

import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Suggestion {
  value: string
  data: {
    city?: string
    street_with_type?: string
    house?: string
    block?: string
    settlement_with_type?: string
  }
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
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function fetchSuggestions(query: string) {
    if (query.length < 3) { setSuggestions([]); setOpen(false); return }
    setLoading(true)
    try {
      const res = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${process.env.NEXT_PUBLIC_DADATA_TOKEN}`,
        },
        body: JSON.stringify({
          query,
          count: 6,
          locations: [{ city: 'Казань' }],
          restrict_value: true,
        }),
      })
      const data = await res.json()
      setSuggestions(data.suggestions || [])
      setOpen((data.suggestions || []).length > 0)
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
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
    <div ref={wrapperRef} className="relative">
      <Input
        value={value}
        onChange={handleChange}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className={className}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg overflow-hidden">
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
    </div>
  )
}
