import apiClient from './client';

export const useCaseApi = {
  list: (projectId: string) => apiClient.get(`/projects/${projectId}/use-cases`).then(r => r.data),
  create: (projectId: string, data: any) => apiClient.post(`/projects/${projectId}/use-cases`, data).then(r => r.data),
  update: (projectId: string, id: string, data: any) => apiClient.put(`/projects/${projectId}/use-cases/${id}`, data).then(r => r.data),
  delete: (projectId: string, id: string) => apiClient.delete(`/projects/${projectId}/use-cases/${id}`).then(r => r.data),
};

export const userStoryApi = {
  list: (projectId: string) => apiClient.get(`/projects/${projectId}/user-stories`).then(r => r.data),
  create: (projectId: string, data: any) => apiClient.post(`/projects/${projectId}/user-stories`, data).then(r => r.data),
  update: (projectId: string, id: string, data: any) => apiClient.put(`/projects/${projectId}/user-stories/${id}`, data).then(r => r.data),
  delete: (projectId: string, id: string) => apiClient.delete(`/projects/${projectId}/user-stories/${id}`).then(r => r.data),
};
