import apiClient from './client'

export interface VersionSnapshot {
  id: string
  projectId: string
  entityType: string
  version: string
  label: string
  reason?: string
  snapshot: any
  createdBy: string
  createdAt: string
  creator?: { id: string; name: string }
}

export const versionApi = {
  save: (projectId: string, entityType: string, data: { version: string; label: string; reason?: string }) =>
    apiClient.post<VersionSnapshot>(`/projects/${projectId}/versions/${entityType}`, data).then(r => r.data),
  list: (projectId: string, entityType: string) =>
    apiClient.get<VersionSnapshot[]>(`/projects/${projectId}/versions/${entityType}`).then(r => r.data),
  get: (projectId: string, entityType: string, versionId: string) =>
    apiClient.get<VersionSnapshot>(`/projects/${projectId}/versions/${entityType}/${versionId}`).then(r => r.data),
  diff: (projectId: string, entityType: string, v1: string, v2: string) =>
    apiClient.get(`/projects/${projectId}/versions/${entityType}/diff/compare?v1=${v1}&v2=${v2}`).then(r => r.data),
  restore: (projectId: string, entityType: string, versionId: string) =>
    apiClient.post(`/projects/${projectId}/versions/${entityType}/restore`, { versionId }).then(r => r.data),
}
