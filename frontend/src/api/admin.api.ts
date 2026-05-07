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
  openai: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini', 'o4-mini', 'o3', 'o3-mini', 'gpt-4-turbo'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  bedrock: ['us.anthropic.claude-sonnet-4-20250514-v1:0', 'us.anthropic.claude-opus-4-20250514-v1:0', 'us.anthropic.claude-3-7-sonnet-20250219-v1:0', 'us.amazon.nova-pro-v1:0', 'us.meta.llama4-scout-17b-instruct-v1:0'],
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
  listLLMAccess: () => apiClient.get('/admin/llm-access').then(r => r.data),
  grantLLMAccess: (userId: string, llmConfigId: string) => apiClient.post('/admin/llm-access', { userId, llmConfigId }).then(r => r.data),
  revokeLLMAccess: (userId: string, llmConfigId: string) => apiClient.delete(`/admin/llm-access/${userId}/${llmConfigId}`).then(r => r.data),
}

export const aiStatusApi = {
  check: (projectId: string) => apiClient.get<{ configured: boolean; models: { id: string; label: string; type: string }[] }>(`/projects/${projectId}/ai/status`).then(r => r.data),
}
