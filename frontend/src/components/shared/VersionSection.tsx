import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GitBranch, Eye } from 'lucide-react'
import { versionApi } from '@/api/version.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from './Modal'

interface Props {
  projectId: string
  entityType: string
}

export function VersionSection({ projectId, entityType }: Props) {
  const qc = useQueryClient()
  const [showSave, setShowSave] = useState(false)
  const [diffModal, setDiffModal] = useState<{ v1: string; v2: string } | null>(null)
  const [form, setForm] = useState({ version: '', label: '', reason: '' })

  const { data: versions = [] } = useQuery({
    queryKey: ['versions', projectId, entityType],
    queryFn: () => versionApi.list(projectId, entityType),
  })

  const saveMutation = useMutation({
    mutationFn: () => versionApi.save(projectId, entityType, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['versions', projectId, entityType] })
      setShowSave(false)
      setForm({ version: '', label: '', reason: '' })
    },
  })

  const restoreMutation = useMutation({
    mutationFn: (versionId: string) => versionApi.restore(projectId, entityType, versionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['versions', projectId, entityType] }),
  })

  const { data: diffData } = useQuery({
    queryKey: ['diff', diffModal?.v1, diffModal?.v2],
    queryFn: () => versionApi.diff(projectId, entityType, diffModal!.v1, diffModal!.v2),
    enabled: !!diffModal,
  })

  return (
    <>
      <div className="space-y-2">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setShowSave(true)}>
            <GitBranch size={14} />
            버전 저장
          </Button>
        </div>

        {versions.length === 0 ? (
          <p className="text-sm text-gray-400">버전 이력이 없습니다</p>
        ) : (
          <table className="w-full text-sm border rounded overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-600">버전</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">변경 사유</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">작성자</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">일시</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v, i) => (
                <tr key={v.id} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{v.version}</td>
                  <td className="px-3 py-2 text-gray-600">{v.reason || v.label}</td>
                  <td className="px-3 py-2 text-gray-500">{v.creator?.name}</td>
                  <td className="px-3 py-2 text-gray-400 text-xs">{new Date(v.createdAt).toLocaleDateString('ko-KR')}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {i < versions.length - 1 && (
                        <button
                          onClick={() => setDiffModal({ v1: versions[i + 1].id, v2: v.id })}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title="비교"
                        >
                          <Eye size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => { if (confirm('이 버전으로 복원하시겠습니까?')) restoreMutation.mutate(v.id) }}
                        className="text-xs text-gray-400 hover:text-orange-600 px-1"
                      >
                        복원
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={showSave} onClose={() => setShowSave(false)} title="버전 저장">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>버전명 *</Label>
            <Input placeholder="v1.0" value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>설명 *</Label>
            <Input placeholder="고객 1차 협의 반영" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>변경 사유</Label>
            <Input placeholder="변경 사유 입력" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSave(false)}>취소</Button>
            <Button
              disabled={!form.version || !form.label || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              저장
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!diffModal} onClose={() => setDiffModal(null)} title="버전 비교" className="max-w-2xl">
        {diffData && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-semibold mb-2">{diffData.v1?.version}</p>
              <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-64">
                {JSON.stringify(diffData.v1?.snapshot, null, 2)}
              </pre>
            </div>
            <div>
              <p className="font-semibold mb-2">{diffData.v2?.version}</p>
              <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-64">
                {JSON.stringify(diffData.v2?.snapshot, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
