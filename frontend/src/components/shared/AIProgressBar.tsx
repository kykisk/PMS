import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'

const STEPS = [
  { label: 'AI 모델 연결 중...', duration: 1500 },
  { label: '문서 분석 중...', duration: 3000 },
  { label: '요구사항 추출 중...', duration: 5000 },
  { label: '결과 정리 중...', duration: 2000 },
]

interface Props {
  isActive: boolean
  type?: 'parse' | 'generate'
}

export function AIProgressBar({ isActive, type = 'parse' }: Props) {
  const [step, setStep] = useState(0)
  const [progress, setProgress] = useState(0)

  const steps = type === 'generate'
    ? [{ label: 'AI 모델 연결 중...', duration: 1500 }, { label: '컨텍스트 분석 중...', duration: 2000 }, { label: '항목 생성 중...', duration: 5000 }, { label: '결과 정리 중...', duration: 2000 }]
    : STEPS

  useEffect(() => {
    if (!isActive) { setStep(0); setProgress(0); return }

    let totalElapsed = 0
    const totalDuration = steps.reduce((s, st) => s + st.duration, 0)
    const interval = setInterval(() => {
      totalElapsed += 100
      const pct = Math.min(95, (totalElapsed / totalDuration) * 100)
      setProgress(pct)

      let elapsed = 0
      for (let i = 0; i < steps.length; i++) {
        elapsed += steps[i].duration
        if (totalElapsed < elapsed) { setStep(i); break }
        if (i === steps.length - 1) setStep(i)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [isActive])

  if (!isActive) return null

  return (
    <div className="space-y-2 py-2">
      <div className="flex items-center gap-2">
        <Loader2 size={12} className="animate-spin text-[#5E6AD2]" />
        <span className="text-xs text-gray-600">{steps[step]?.label}</span>
        <span className="ml-auto text-[10px] text-gray-400">{Math.round(progress)}%</span>
      </div>
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#5E6AD2] rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-[10px] text-gray-400">AI 응답 시간은 모델과 문서 크기에 따라 다릅니다</p>
    </div>
  )
}
