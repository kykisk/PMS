import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Pencil, Sparkles, Database, Globe, Download } from 'lucide-react'
import { designApi } from '@/api/design.api'
import { exportApi } from '@/api/export.api'
import { aiStatusApi } from '@/api/admin.api'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/shared/Modal'
import { Badge } from '@/components/shared/Badge'
import { TableSkeleton } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { AncestorTags } from '@/components/shared/AncestorTags'
import AppLayout from '@/components/layout/AppLayout'

type Tab = 'db' | 'api'

export default function DesignPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('db')
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<any>(null)
  const [generating, setGenerating] = useState(false)
  const [preview, setPreview] = useState<any[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const [dbForm, setDbForm] = useState({ name: '', description: '', featureId: '', columns: '' })
  const [apiForm, setApiForm] = useState({ method: 'GET', path: '', summary: '', featureId: '', requestBody: '', responseBody: '' })

  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status', projectId],
    queryFn: () => aiStatusApi.check(projectId!),
    enabled: !!projectId,
  })

  const { data: dbTables = [], isLoading: dbLoading } = useQuery({
    queryKey: ['design-db', projectId],
    queryFn: () => designApi.listDbTables(projectId!),
    enabled: !!projectId && tab === 'db',
  })

  const { data: apiSpecs = [], isLoading: apiLoading } = useQuery({
    queryKey: ['design-api', projectId],
    queryFn: () => designApi.listApiSpecs(projectId!),
    enabled: !!projectId && tab === 'api',
  })

  const createDbMutation = useMutation({
    mutationFn: (data: any) => designApi.createDbTable(projectId!, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['design-db', projectId] }); setShowCreate(false); resetDbForm() },
  })

  const updateDbMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => designApi.updateDbTable(projectId!, id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['design-db', projectId] }); setEditTarget(null); resetDbForm() },
  })

  const deleteDbMutation = useMutation({
    mutationFn: (id: string) => designApi.deleteDbTable(projectId!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['design-db', projectId] }),
  })

  const createApiMutation = useMutation({
    mutationFn: (data: any) => designApi.createApiSpec(projectId!, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['design-api', projectId] }); setShowCreate(false); resetApiForm() },
  })

  const updateApiMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => designApi.updateApiSpec(projectId!, id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['design-api', projectId] }); setEditTarget(null); resetApiForm() },
  })

  const deleteApiMutation = useMutation({
    mutationFn: (id: string) => designApi.deleteApiSpec(projectId!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['design-api', projectId] }),
  })

  const [showGenConfirm, setShowGenConfirm] = useState(false)
  const [selectedModel, setSelectedModel] = useState('')
  const [tableSelected, setTableSelected] = useState<Set<string>>(new Set())

  const toggleTableSelect = (id: string) => setTableSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAllTable = () => {
    const items = tab === 'db' ? (dbTables as any[]) : (apiSpecs as any[])
    setTableSelected(prev => prev.size === items.length ? new Set() : new Set(items.map((i: any) => i.id)))
  }

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (tab === 'db') await Promise.all(ids.map(id => designApi.deleteDbTable(projectId!, id)))
      else await Promise.all(ids.map(id => designApi.deleteApiSpec(projectId!, id)))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [tab === 'db' ? 'design-db' : 'design-api', projectId] })
      setTableSelected(new Set())
    },
  })

  const resetDbForm = () => setDbForm({ name: '', description: '', featureId: '', columns: '' })
  const resetApiForm = () => setApiForm({ method: 'GET', path: '', summary: '', featureId: '', requestBody: '', responseBody: '' })

  const handleGenerate = async () => {
    if (!projectId) return
    setShowGenConfirm(false)
    setGenerating(true)
    try {
      const result = tab === 'db'
        ? await designApi.generateDb(projectId, selectedModel || undefined)
        : await designApi.generateApi(projectId, selectedModel || undefined)
      const items = Array.isArray(result) ? result : result?.items ?? result?.data ?? []
      setPreview(items)
      setSelected(new Set(items.map((_: any, i: number) => i)))
      setShowPreview(true)
    } catch {
      setPreview([])
    } finally {
      setGenerating(false)
    }
  }

  const handleSavePreview = async () => {
    if (!projectId) return
    const items = preview.filter((_, i) => selected.has(i))
    const allFeatures = await import('@/api/feature.api').then(m => m.featureApi.list(projectId!))
    const featureList = (allFeatures as any)?.data ?? []
    const findFeatureId = (title?: string) => {
      if (!title) return undefined
      const match = featureList.find((f: any) =>
        f.title.toLowerCase().includes(title.toLowerCase().slice(0, 10)) ||
        title.toLowerCase().includes(f.title.toLowerCase().slice(0, 10))
      )
      return match?.id
    }
    for (const item of items) {
      const featureId = item.featureId || findFeatureId(item.featureTitle) || undefined
      const tableName = item.name || item.tableName || `table_${Date.now()}`
      if (tab === 'db') {
        await designApi.createDbTable(projectId, { ...item, name: tableName, featureId })
      } else {
        await designApi.createApiSpec(projectId, { ...item, featureId })
      }
    }
    qc.invalidateQueries({ queryKey: [tab === 'db' ? 'design-db' : 'design-api', projectId] })
    setShowPreview(false)
    setPreview([])
  }

  const toggleSelect = (idx: number) => {
    const s = new Set(selected)
    s.has(idx) ? s.delete(idx) : s.add(idx)
    setSelected(s)
  }

  return (
    <AppLayout>
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex border rounded overflow-hidden">
            <button onClick={() => { setTab('db'); setTableSelected(new Set()) }} className={`px-3 py-1.5 text-xs font-medium ${tab === 'db' ? 'bg-[#5E6AD2] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              <Database size={12} className="inline mr-1" />DB 설계
            </button>
            <button onClick={() => { setTab('api'); setTableSelected(new Set()) }} className={`px-3 py-1.5 text-xs font-medium ${tab === 'api' ? 'bg-[#5E6AD2] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              <Globe size={12} className="inline mr-1" />API 설계
            </button>
          </div>
          <div className="ml-auto flex gap-2">
            {aiStatus?.configured && (
              <Button variant="outline" size="sm" onClick={() => setShowGenConfirm(true)} disabled={generating} className="h-7 text-xs gap-1">
                <Sparkles size={12} />{generating ? '생성중...' : 'AI 생성'}
              </Button>
            )}
            <Button variant="outline" size="sm"
              onClick={() => tab === 'db' ? exportApi.dbDesign(projectId!) : exportApi.apiDesign(projectId!)}
              className="h-7 text-xs gap-1">
              <Download size={12} />{tab === 'db' ? 'DB정의서' : 'API명세서'}
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)} className="h-7 text-xs gap-1">
              <Plus size={12} />추가
            </Button>
          </div>
        </div>

        {generating && (
          <div className="mb-3 bg-[#5E6AD2]/5 border border-[#5E6AD2]/20 rounded p-2 flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-[#5E6AD2] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-[#5E6AD2]">AI가 설계를 생성하고 있습니다...</span>
          </div>
        )}

        {tab === 'db' && (
          dbLoading ? <TableSkeleton /> : dbTables.length === 0 ? <EmptyState message="DB 테이블이 없습니다" /> : (
            <>
              {tableSelected.size > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-md mb-2">
                  <span className="text-xs text-red-600 font-medium">{tableSelected.size}개 선택됨</span>
                  <button onClick={() => { if (confirm(`선택한 ${tableSelected.size}개를 삭제하시겠습니까?`)) bulkDeleteMutation.mutate([...tableSelected]) }} className="text-xs px-2 py-0.5 bg-red-500 text-white rounded hover:bg-red-600">선택 삭제</button>
                  <button onClick={() => { if (confirm(`전체 ${(dbTables as any[]).length}개를 삭제하시겠습니까?`)) bulkDeleteMutation.mutate((dbTables as any[]).map((t: any) => t.id)) }} className="text-xs px-2 py-0.5 border border-red-400 text-red-600 rounded hover:bg-red-50">전체 삭제</button>
                  <button onClick={() => setTableSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-600 ml-auto">취소</button>
                </div>
              )}
            <div className="border rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="w-8 px-2 py-2"><input type="checkbox" checked={(dbTables as any[]).length > 0 && tableSelected.size === (dbTables as any[]).length} onChange={toggleAllTable} className="w-3.5 h-3.5" /></th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">테이블명</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">설명</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">연결기능</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600">컬럼수</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(dbTables as any[]).map((t: any) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-2 py-2" onClick={e => e.stopPropagation()}><input type="checkbox" checked={tableSelected.has(t.id)} onChange={() => toggleTableSelect(t.id)} className="w-3.5 h-3.5" /></td>
                      <td className="px-3 py-2 font-mono font-medium">{t.name}</td>
                      <td className="px-3 py-2 text-gray-600 truncate max-w-[200px]">{t.description || '-'}</td>
                      <td className="px-3 py-2">{t.feature ? <AncestorTags tags={[{ code: t.feature.code, title: t.feature.title, type: 'feature', id: t.feature.id }]} /> : <span className="text-gray-300">-</span>}</td>
                      <td className="px-3 py-2 text-center">{(t.columns as any[])?.length ?? 0}</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => { setEditTarget(t); setDbForm({ name: t.name, description: t.description || '', featureId: t.featureId || '', columns: JSON.stringify(t.columns || [], null, 2) }) }} className="text-gray-400 hover:text-[#5E6AD2] mr-2"><Pencil size={13} /></button>
                        <button onClick={() => deleteDbMutation.mutate(t.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )
        )}

        {tab === 'api' && (
          apiLoading ? <TableSkeleton /> : apiSpecs.length === 0 ? <EmptyState message="API 스펙이 없습니다" /> : (
            <>
              {tableSelected.size > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-md mb-2">
                  <span className="text-xs text-red-600 font-medium">{tableSelected.size}개 선택됨</span>
                  <button onClick={() => { if (confirm(`선택한 ${tableSelected.size}개를 삭제하시겠습니까?`)) bulkDeleteMutation.mutate([...tableSelected]) }} className="text-xs px-2 py-0.5 bg-red-500 text-white rounded hover:bg-red-600">선택 삭제</button>
                  <button onClick={() => { if (confirm(`전체 ${(apiSpecs as any[]).length}개를 삭제하시겠습니까?`)) bulkDeleteMutation.mutate((apiSpecs as any[]).map((a: any) => a.id)) }} className="text-xs px-2 py-0.5 border border-red-400 text-red-600 rounded hover:bg-red-50">전체 삭제</button>
                  <button onClick={() => setTableSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-600 ml-auto">취소</button>
                </div>
              )}
            <div className="border rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="w-8 px-2 py-2"><input type="checkbox" checked={(apiSpecs as any[]).length > 0 && tableSelected.size === (apiSpecs as any[]).length} onChange={toggleAllTable} className="w-3.5 h-3.5" /></th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Method</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">경로</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">요약</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">연결기능</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(apiSpecs as any[]).map((a: any) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-2 py-2" onClick={e => e.stopPropagation()}><input type="checkbox" checked={tableSelected.has(a.id)} onChange={() => toggleTableSelect(a.id)} className="w-3.5 h-3.5" /></td>
                      <td className="px-3 py-2"><Badge value={a.method} /></td>
                      <td className="px-3 py-2 font-mono">{a.path}</td>
                      <td className="px-3 py-2 text-gray-600 truncate max-w-[200px]">{a.summary || '-'}</td>
                      <td className="px-3 py-2">{a.feature ? <AncestorTags tags={[{ code: a.feature.code, title: a.feature.title, type: 'feature', id: a.feature.id }]} /> : <span className="text-gray-300">-</span>}</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => { setEditTarget(a); setApiForm({ method: a.method, path: a.path, summary: a.summary || '', featureId: a.featureId || '', requestBody: a.requestBody || '', responseBody: a.responseBody || '' }) }} className="text-gray-400 hover:text-[#5E6AD2] mr-2"><Pencil size={13} /></button>
                        <button onClick={() => deleteApiMutation.mutate(a.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )
        )}

        <Modal open={showCreate || !!editTarget} onClose={() => { setShowCreate(false); setEditTarget(null); resetDbForm(); resetApiForm() }} title={tab === 'db' ? (editTarget ? 'DB 테이블 수정' : 'DB 테이블 추가') : (editTarget ? 'API 스펙 수정' : 'API 스펙 추가')}>
          {tab === 'db' ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">테이블명 *</label>
                <input className="w-full border rounded px-2 py-1.5 text-xs h-7" value={dbForm.name} onChange={e => setDbForm(f => ({ ...f, name: e.target.value }))} placeholder="users" />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">설명</label>
                <input className="w-full border rounded px-2 py-1.5 text-xs h-7" value={dbForm.description} onChange={e => setDbForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">컬럼 (JSON)</label>
                <textarea className="w-full border rounded px-2 py-1.5 text-xs h-24 font-mono" value={dbForm.columns} onChange={e => setDbForm(f => ({ ...f, columns: e.target.value }))} placeholder='[{"name":"id","type":"uuid","pk":true}]' />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => { setShowCreate(false); setEditTarget(null) }} className="h-7 text-xs">취소</Button>
                <Button size="sm" className="h-7 text-xs" onClick={() => {
                  const payload = { name: dbForm.name, description: dbForm.description, featureId: dbForm.featureId || undefined, columns: dbForm.columns ? JSON.parse(dbForm.columns) : undefined }
                  editTarget ? updateDbMutation.mutate({ id: editTarget.id, data: payload }) : createDbMutation.mutate(payload)
                }} disabled={!dbForm.name}>저장</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Method *</label>
                  <select className="w-full border rounded px-2 py-1.5 text-xs h-7" value={apiForm.method} onChange={e => setApiForm(f => ({ ...f, method: e.target.value }))}>
                    {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-600 mb-1 block">경로 *</label>
                  <input className="w-full border rounded px-2 py-1.5 text-xs h-7" value={apiForm.path} onChange={e => setApiForm(f => ({ ...f, path: e.target.value }))} placeholder="/api/users" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">요약</label>
                <input className="w-full border rounded px-2 py-1.5 text-xs h-7" value={apiForm.summary} onChange={e => setApiForm(f => ({ ...f, summary: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Request Body</label>
                <textarea className="w-full border rounded px-2 py-1.5 text-xs h-16 font-mono" value={apiForm.requestBody} onChange={e => setApiForm(f => ({ ...f, requestBody: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Response Body</label>
                <textarea className="w-full border rounded px-2 py-1.5 text-xs h-16 font-mono" value={apiForm.responseBody} onChange={e => setApiForm(f => ({ ...f, responseBody: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => { setShowCreate(false); setEditTarget(null) }} className="h-7 text-xs">취소</Button>
                <Button size="sm" className="h-7 text-xs" onClick={() => {
                  const payload = { method: apiForm.method, path: apiForm.path, summary: apiForm.summary, featureId: apiForm.featureId || undefined, requestBody: apiForm.requestBody || undefined, responseBody: apiForm.responseBody || undefined }
                  editTarget ? updateApiMutation.mutate({ id: editTarget.id, data: payload }) : createApiMutation.mutate(payload)
                }} disabled={!apiForm.path}>저장</Button>
              </div>
            </div>
          )}
        </Modal>

        <Modal open={showPreview} onClose={() => setShowPreview(false)} title="AI 생성 결과 미리보기" className="max-w-lg">
          <div className="space-y-2 max-h-80 overflow-auto">
            {preview.map((item, idx) => (
              <label key={idx} className="flex items-start gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={selected.has(idx)} onChange={() => toggleSelect(idx)} className="mt-0.5" />
                <div className="text-xs flex-1 min-w-0">
                  {tab === 'db' ? (
                    <>
                      <span className="font-mono font-medium">{item.name ?? item.tableName ?? '(unnamed)'}</span>
                      {item.description && <span className="text-gray-500 ml-2">{item.description}</span>}
                    </>
                  ) : (
                    <>
                      <Badge value={item.method || 'GET'} />
                      <span className="font-mono ml-2">{item.path}</span>
                      {item.summary && <span className="text-gray-500 ml-2">{item.summary}</span>}
                    </>
                  )}
                </div>
              </label>
            ))}
            {preview.length === 0 && <p className="text-xs text-gray-500 text-center py-4">생성된 항목이 없습니다</p>}
          </div>
          <div className="flex justify-between items-center mt-4 pt-3 border-t">
            <span className="text-xs text-gray-500">{selected.size}/{preview.length} 선택됨</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowPreview(false)} className="h-7 text-xs">취소</Button>
              <Button size="sm" onClick={handleSavePreview} disabled={selected.size === 0} className="h-7 text-xs">선택 항목 저장</Button>
            </div>
          </div>
        </Modal>

        <Modal open={showGenConfirm} onClose={() => setShowGenConfirm(false)} title={`AI ${tab === 'db' ? 'DB 설계' : 'API 설계'} 생성`} className="max-w-sm">
          <div className="space-y-3">
            <p className="text-xs text-gray-600">
              현재 프로젝트의 기능 목록을 AI가 분석하여 {tab === 'db' ? 'DB 테이블 설계' : 'API 명세'}를 자동 생성합니다.
            </p>
            {aiStatus?.models && aiStatus.models.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs text-gray-500">AI 모델 선택</label>
                <select className="w-full border rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]"
                  value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
                  <option value="">자동 선택 (기본)</option>
                  {aiStatus.models.map((m: any) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setShowGenConfirm(false)} className="h-7 text-xs">취소</Button>
              <Button size="sm" onClick={handleGenerate} className="h-7 text-xs gap-1">
                <Sparkles size={12} />생성 시작
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AppLayout>
  )
}
