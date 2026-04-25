'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload, X, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  value: string[]
  onChange: (urls: string[]) => void
  onUpload: (files: File[]) => Promise<string[]>
  uploading?: boolean
  className?: string
}

export function FileUpload({ value, onChange, onUpload, uploading, className }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const accepted = Array.from(files).filter(f => f.type === 'image/jpeg' || f.type === 'image/png')
    if (accepted.length === 0) return
    const urls = await onUpload(accepted)
    onChange([...value, ...urls])
  }, [value, onChange, onUpload])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const removePhoto = (url: string) => {
    onChange(value.filter(u => u !== url))
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div
        className={cn(
          'relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30',
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept="image/jpeg,image/png"
          onChange={e => handleFiles(e.target.files)}
        />
        <Upload className="w-8 h-8 mx-auto mb-3 text-primary" />
        <p className="font-semibold text-sm">Перетащите фото сюда или выберите файлы</p>
        <p className="text-xs text-muted-foreground mt-1">
          JPG и PNG можно загружать пачкой. Перед отправкой фото автоматически уменьшаются и сжимаются.{' '}
          {value.length > 0 && <span className="text-primary">Сейчас прикреплено: {value.length} фото.</span>}
        </p>
        {uploading && (
          <p className="text-xs text-primary mt-2 font-medium">Загрузка...</p>
        )}
      </div>

      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {value.map((url, i) => (
            <div key={url} className="group relative">
              <div className="aspect-square rounded-xl overflow-hidden bg-muted">
                <img src={url} alt={`Фото ${i + 1}`} className="w-full h-full object-cover" />
              </div>
              <div className="flex items-center justify-between mt-1 px-0.5">
                <p className="text-xs text-muted-foreground truncate">Фото {i + 1}</p>
                <button
                  type="button"
                  onClick={() => removePhoto(url)}
                  className="text-destructive hover:text-destructive/80 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground truncate px-0.5 opacity-60" style={{ fontSize: 10 }}>
                {url.split('/').pop()?.slice(0, 20)}...
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
