import { useRef, useCallback, useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload, X, ImageIcon, Clipboard, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react'
import { featureApi } from '@/api/feature.api'

interface Props {
  projectId: string
  featureId: string
}

export function ScreenDesignSection({ projectId, featureId }: Props) {
  const qc = useQueryClient()
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: images = [] } = useQuery({
    queryKey: ['screen-images', featureId],
    queryFn: () => featureApi.listScreenImages(projectId, featureId),
    enabled: !!featureId,
  })

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => featureApi.uploadScreenImages(projectId, featureId, files),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['screen-images', featureId] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (imageId: string) => featureApi.deleteScreenImage(projectId, featureId, imageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['screen-images', featureId] }),
  })

  const handleFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/') || f.type === 'application/pdf')
    if (arr.length) uploadMutation.mutate(arr)
  }, [uploadMutation])

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      const imageFiles: File[] = []
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) imageFiles.push(new File([file], `paste-${Date.now()}.png`, { type: file.type }))
        }
      }
      if (imageFiles.length) { e.preventDefault(); handleFiles(imageFiles) }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [handleFiles])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  const getImageUrl = (url: string) => url.startsWith('/') ? url : '/' + url
  const [lightbox, setLightbox] = useState<{ index: number } | null>(null)
  const imageList = (images as any[]).filter((img: any) => img.mimeType?.startsWith('image/'))
  const openLightbox = (img: any) => {
    const idx = imageList.findIndex((i: any) => i.id === img.id)
    if (idx >= 0) setLightbox({ index: idx })
    else window.open(getImageUrl(img.url), '_blank')
  }
  const closeLightbox = () => setLightbox(null)
  const prevImg = () => setLightbox(l => l ? { index: (l.index - 1 + imageList.length) % imageList.length } : null)
  const nextImg = () => setLightbox(l => l ? { index: (l.index + 1) % imageList.length } : null)
  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowLeft') prevImg()
      if (e.key === 'ArrowRight') nextImg()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  return (
    <div className="space-y-3">
      <div
        onDragEnter={() => setDragging(true)}
        onDragLeave={() => setDragging(false)}
        onDragOver={e => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          dragging ? 'border-[#5E6AD2] bg-[#5E6AD2]/5' : 'border-gray-200 hover:border-[#5E6AD2]/50 hover:bg-gray-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.fig"
          className="hidden"
          onChange={e => e.target.files && handleFiles(e.target.files)}
        />
        <div className="flex items-center justify-center gap-2 text-gray-400">
          {uploadMutation.isPending ? (
            <span className="text-xs">업로드 중...</span>
          ) : (
            <>
              <Upload size={14} />
              <span className="text-xs">클릭 / 드래그앤드롭 / </span>
              <span className="inline-flex items-center gap-1 text-xs bg-gray-100 px-1.5 py-0.5 rounded border">
                <Clipboard size={11} />Ctrl+V
              </span>
            </>
          )}
        </div>
        <p className="text-[10px] text-gray-300 mt-1">PNG, JPG, PDF, FIG · 여러 장 가능</p>
      </div>

      {(images as any[]).length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {(images as any[]).map((img: any) => (
            <div key={img.id} className="relative group rounded-lg border overflow-hidden bg-gray-50">
              {img.mimeType?.startsWith('image/') ? (
                <div className="relative cursor-pointer" onClick={() => openLightbox(img)}>
                  <img
                    src={getImageUrl(img.url)}
                    alt={img.originalName}
                    className="w-full h-auto object-contain max-h-64"
                    title={img.originalName}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <ZoomIn size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                  </div>
                </div>
              ) : (
                <div className="h-32 flex flex-col items-center justify-center gap-1 cursor-pointer"
                  onClick={() => window.open(getImageUrl(img.url), '_blank')}>
                  <ImageIcon size={24} className="text-gray-400" />
                  <span className="text-xs text-gray-500 truncate px-2 max-w-full">{img.originalName}</span>
                </div>
              )}
              <div className="px-2 py-1.5 flex items-center justify-between bg-white border-t">
                <span className="text-[10px] text-gray-400 truncate max-w-[80%]">{img.originalName}</span>
                <button
                  onClick={e => { e.stopPropagation(); if (confirm('삭제하시겠습니까?')) deleteMutation.mutate(img.id) }}
                  className="w-5 h-5 bg-red-100 text-red-500 hover:bg-red-500 hover:text-white rounded flex items-center justify-center transition-colors flex-shrink-0"
                >
                  <X size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(images as any[]).length === 0 && (
        <p className="text-xs text-gray-400 text-center">화면설계서가 없습니다</p>
      )}

      {lightbox && imageList[lightbox.index] && (
        <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center" onClick={closeLightbox}>
          <div className="relative max-w-[95vw] max-h-[95vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <img
              src={getImageUrl(imageList[lightbox.index].url)}
              alt={imageList[lightbox.index].originalName}
              className="max-w-full max-h-[85vh] object-contain rounded shadow-2xl"
            />
            <p className="text-white/70 text-xs mt-2">{imageList[lightbox.index].originalName} ({lightbox.index + 1}/{imageList.length})</p>
          </div>
          {imageList.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); prevImg() }} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/40 text-white rounded-full flex items-center justify-center transition-colors">
                <ChevronLeft size={20} />
              </button>
              <button onClick={e => { e.stopPropagation(); nextImg() }} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/40 text-white rounded-full flex items-center justify-center transition-colors">
                <ChevronRight size={20} />
              </button>
            </>
          )}
          <button onClick={closeLightbox} className="absolute top-4 right-4 w-8 h-8 bg-white/20 hover:bg-white/40 text-white rounded-full flex items-center justify-center transition-colors">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
