import apiClient from './client'

export interface Project {
  id: string
  name: string
  description?: string
  status: string
  startDate?: string
  endDate?: string
  createdBy: string
  createdAt: string
  members?: { user: { id: string; name: string; email: string } }[]
  _count?: { requirements: number; features: number; tasks: number; testScenarios: number }
}

export interface CreateProjectPayload {
  name: string
  description?: string
  startDate?: string
  endDate?: string
}

export const projectApi = {
  list: (query?: { search?: string; status?: string; from?: string; to?: string }) =>
    apiClient.get<Project[]>('/projects', { params: query }).then(r => r.data),
  get: (id: string) => apiClient.get<Project>(`/projects/${id}`).then(r => r.data),
  create: (data: CreateProjectPayload) => apiClient.post<Project>('/projects', data).then(r => r.data),
  update: (id: string, data: Partial<CreateProjectPayload & { status: string }>) =>
    apiClient.put<Project>(`/projects/${id}`, data).then(r => r.data),
  remove: (id: string) => apiClient.delete(`/projects/${id}`).then(r => r.data),
  dashboard: (id: string) => apiClient.get(`/projects/${id}/dashboard`).then(r => r.data),
  members: (id: string) => apiClient.get(`/projects/${id}/members`).then(r => r.data),
  addMember: (id: string, userId: string) =>
    apiClient.post(`/projects/${id}/members`, { userId }).then(r => r.data),
  removeMember: (id: string, userId: string) =>
    apiClient.delete(`/projects/${id}/members/${userId}`).then(r => r.data),
  getSettings: (projectId: string) =>
    apiClient.get(`/projects/${projectId}/settings`).then(r => r.data),
  updateMemberRole: (projectId: string, userId: string, data: { role: string; note?: string }) =>
    apiClient.put(`/projects/${projectId}/members/${userId}/role`, data).then(r => r.data),
  createExternalMember: (projectId: string, data: any) =>
    apiClient.post(`/projects/${projectId}/external-members`, data).then(r => r.data),
  updateExternalMember: (projectId: string, eid: string, data: any) =>
    apiClient.put(`/projects/${projectId}/external-members/${eid}`, data).then(r => r.data),
  deleteExternalMember: (projectId: string, eid: string) =>
    apiClient.delete(`/projects/${projectId}/external-members/${eid}`).then(r => r.data),
  getAuditHistory: (projectId: string, entityType?: string, entityId?: string) =>
    apiClient.get(`/projects/${projectId}/audit/history`, { params: { entityType, entityId, limit: 30 } }).then(r => r.data),
  clearOutdated: (projectId: string, entityType: string, entityId: string) =>
    apiClient.post(`/projects/${projectId}/audit/clear-outdated`, { entityType, entityId }).then(r => r.data),
  clearOutdatedByRequirement: (projectId: string, reqId: string) =>
    apiClient.post(`/projects/${projectId}/audit/clear-outdated-by-requirement`, { reqId }).then(r => r.data),
  clearOutdatedByFeature: (projectId: string, featureId: string) =>
    apiClient.post(`/projects/${projectId}/audit/clear-outdated-by-feature`, { featureId }).then(r => r.data),
  clearOutdatedScenariosByFeature: (projectId: string, featureId: string) =>
    apiClient.post(`/projects/${projectId}/audit/clear-outdated-scenarios-by-feature`, { featureId }).then(r => r.data),
}
