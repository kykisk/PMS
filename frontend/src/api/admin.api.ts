import apiClient from './client'

export interface LLMConfig {
  id: string
  provider: string
  model: string
  region?: string
  isActive: boolean
  promptTemplates?: Record<string, string>
  createdAt: string
  updatedAt: string
}

export interface AdminUser {
  id: string; email: string; name: string; role: string; language: string; createdAt: string
}

export const PROVIDER_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  gemini: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'],
  bedrock: ['anthropic.claude-3-5-sonnet-20241022-v2:0', 'amazon.titan-text-express-v1', 'meta.llama3-70b-instruct-v1:0'],
}

export interface ExportTemplateColumn {
  key: string; label: string; visible: boolean; width: number;
}
export interface ExportTemplate {
  id: string; type: string; title: string; columns: ExportTemplateColumn[];
  createdAt: string; updatedAt: string;
}

export const adminApi = {
  listLLM: () => apiClient.get<LLMConfig[]>('/admin/llm').then(r => r.data),
  createLLM: (data: Partial<LLMConfig> & { apiKey: string }) => apiClient.post<LLMConfig>('/admin/llm', data).then(r => r.data),
  updateLLM: (id: string, data: Partial<LLMConfig> & { apiKey?: string }) => apiClient.put<LLMConfig>(`/admin/llm/${id}`, data).then(r => r.data),
  deleteLLM: (id: string) => apiClient.delete(`/admin/llm/${id}`).then(r => r.data),
  listUsers: () => apiClient.get<AdminUser[]>('/admin/users').then(r => r.data),
  updateUser: (id: string, data: { role?: string; name?: string }) => apiClient.put<AdminUser>(`/admin/users/${id}`, data).then(r => r.data),
  deleteUser: (id: string) => apiClient.delete(`/admin/users/${id}`).then(r => r.data),
  listTemplates: () => apiClient.get<ExportTemplate[]>('/admin/templates').then(r => r.data),
  updateTemplate: (id: string, data: { title?: string; columns?: ExportTemplateColumn[] }) =>
    apiClient.put<ExportTemplate>(`/admin/templates/${id}`, data).then(r => r.data),
}

export const aiStatusApi = {
  check: (projectId: string) => apiClient.get<{ configured: boolean }>(`/projects/${projectId}/ai/status`).then(r => r.data),
}
