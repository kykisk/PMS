import apiClient from './client';

export const crApi = {
  list: (projectId: string) => apiClient.get(`/projects/${projectId}/change-requests`).then(r => r.data),
  create: (projectId: string, data: any) => apiClient.post(`/projects/${projectId}/change-requests`, data).then(r => r.data),
  get: (projectId: string, id: string) => apiClient.get(`/projects/${projectId}/change-requests/${id}`).then(r => r.data),
  update: (projectId: string, id: string, data: any) => apiClient.put(`/projects/${projectId}/change-requests/${id}`, data).then(r => r.data),
  delete: (projectId: string, id: string) => apiClient.delete(`/projects/${projectId}/change-requests/${id}`).then(r => r.data),
  analyzeImpact: (projectId: string, id: string) => apiClient.get(`/projects/${projectId}/change-requests/${id}/impact`).then(r => r.data),
};
