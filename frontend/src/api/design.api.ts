import apiClient from './client';

export const designApi = {
  listDbTables: (projectId: string) => apiClient.get(`/projects/${projectId}/design/db-tables`).then(r => r.data),
  createDbTable: (projectId: string, data: any) => apiClient.post(`/projects/${projectId}/design/db-tables`, data).then(r => r.data),
  updateDbTable: (projectId: string, id: string, data: any) => apiClient.put(`/projects/${projectId}/design/db-tables/${id}`, data).then(r => r.data),
  deleteDbTable: (projectId: string, id: string) => apiClient.delete(`/projects/${projectId}/design/db-tables/${id}`).then(r => r.data),
  listApiSpecs: (projectId: string) => apiClient.get(`/projects/${projectId}/design/api-specs`).then(r => r.data),
  createApiSpec: (projectId: string, data: any) => apiClient.post(`/projects/${projectId}/design/api-specs`, data).then(r => r.data),
  updateApiSpec: (projectId: string, id: string, data: any) => apiClient.put(`/projects/${projectId}/design/api-specs/${id}`, data).then(r => r.data),
  deleteApiSpec: (projectId: string, id: string) => apiClient.delete(`/projects/${projectId}/design/api-specs/${id}`).then(r => r.data),
  generateDb: (projectId: string, modelId?: string) => apiClient.post(`/projects/${projectId}/design/ai/generate-db`, { modelId }).then(r => r.data),
  generateApi: (projectId: string, modelId?: string) => apiClient.post(`/projects/${projectId}/design/ai/generate-api`, { modelId }).then(r => r.data),
};
