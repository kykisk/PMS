import { Injectable, BadRequestException } from '@nestjs/common';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { AdminService } from '../admin/admin.service';

const DEFAULT_PROMPTS = {
  parseSpec: `당신은 요구사항 분석 전문가입니다. 고객이 제출한 요구사항 기술서를 분석하여 정제된 요구사항 정의서를 만들어주세요.
입력 형식: JSON 배열 [{요구사항구분, 요청사항, 상세내용}]
출력 형식: JSON 배열 [{title, category, description, priority, status}]
- priority: "high" | "medium" | "low"
- status: "new"
- 반드시 유효한 JSON만 출력하세요. 다른 텍스트 없이 JSON만.`,

  parseMarkdown: `당신은 요구사항 분석 전문가입니다. 마크다운 문서에서 요구사항을 추출해주세요.
출력 형식: JSON 배열 [{title, category, description, priority, status}]
- priority: "high" | "medium" | "low"  
- status: "new"
- 반드시 유효한 JSON만 출력하세요.`,

  generateFeatures: `당신은 소프트웨어 설계 전문가입니다. 주어진 요구사항으로부터 기능 리스트를 생성해주세요.
출력 형식: JSON 배열 [{title, description, status}]
- status: "new"
- 각 기능은 구체적이고 구현 가능해야 합니다.
- 반드시 유효한 JSON만 출력하세요.`,

  generateTasks: `당신은 프로젝트 관리 전문가입니다. 주어진 기능으로부터 개발 Task를 생성해주세요.
출력 형식: JSON 배열 [{title, description, status, progress}]
- status: "pending"
- progress: 0
- 반드시 유효한 JSON만 출력하세요.`,

  generateTestScenarios: `당신은 QA 전문가입니다. 주어진 요구사항과 기능으로부터 테스트 시나리오를 생성해주세요.
출력 형식: JSON 배열 [{title, description, type, testData}]
- type: "unit" | "integration"
- testData: 테스트에 사용할 데이터 (없으면 null)
- 반드시 유효한 JSON만 출력하세요.`,
};

@Injectable()
export class AIService {
  constructor(private adminService: AdminService) {}

  private async getModel() {
    const config = await this.adminService.getActiveLLMConfig();
    if (!config) throw new BadRequestException('LLM 설정이 없습니다. 관리자에게 LLM 설정을 요청하세요.');

    switch (config.provider) {
      case 'openai':
        return createOpenAI({ apiKey: config.apiKey })(config.model);
      case 'anthropic':
        return createAnthropic({ apiKey: config.apiKey })(config.model);
      case 'gemini':
        return createGoogleGenerativeAI({ apiKey: config.apiKey })(config.model);
      case 'bedrock':
        return createAmazonBedrock({ region: config.region ?? 'us-east-1' })(config.model);
      default:
        throw new BadRequestException(`지원하지 않는 프로바이더: ${config.provider}`);
    }
  }

  private getPrompt(config: any, key: string): string {
    const templates = config?.promptTemplates as Record<string, string> | null;
    return templates?.[key] || DEFAULT_PROMPTS[key as keyof typeof DEFAULT_PROMPTS] || '';
  }

  private parseJSON(text: string): any[] {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('JSON 배열을 찾을 수 없습니다.');
    return JSON.parse(match[0]);
  }

  async parseSpec(rows: { 요구사항구분?: string; 요청사항?: string; 상세내용?: string }[]): Promise<any[]> {
    const model = await this.getModel();
    const config = await this.adminService.getActiveLLMConfig();
    const systemPrompt = this.getPrompt(config, 'parseSpec');
    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: `다음 요구사항 기술서를 분석해주세요:\n${JSON.stringify(rows, null, 2)}`,
      maxOutputTokens: 4000,
    });
    try { return this.parseJSON(text); }
    catch { return [{ _rawText: text, _parseError: true }]; }
  }

  async parseMarkdown(content: string): Promise<any[]> {
    const model = await this.getModel();
    const config = await this.adminService.getActiveLLMConfig();
    const { text } = await generateText({
      model,
      system: this.getPrompt(config, 'parseMarkdown'),
      prompt: `다음 마크다운 문서에서 요구사항을 추출해주세요:\n\n${content}`,
      maxOutputTokens: 4000,
    });
    try { return this.parseJSON(text); }
    catch { return [{ _rawText: text, _parseError: true }]; }
  }

  async generateFeatures(requirement: { title: string; description?: string; category?: string }): Promise<any[]> {
    const model = await this.getModel();
    const config = await this.adminService.getActiveLLMConfig();
    const { text } = await generateText({
      model,
      system: this.getPrompt(config, 'generateFeatures'),
      prompt: `요구사항: ${requirement.title}\n분류: ${requirement.category ?? ''}\n설명: ${requirement.description ?? ''}`,
      maxOutputTokens: 2000,
    });
    try { return this.parseJSON(text); }
    catch { return [{ _rawText: text, _parseError: true }]; }
  }

  async generateTasks(feature: { title: string; description?: string }): Promise<any[]> {
    const model = await this.getModel();
    const config = await this.adminService.getActiveLLMConfig();
    const { text } = await generateText({
      model,
      system: this.getPrompt(config, 'generateTasks'),
      prompt: `기능: ${feature.title}\n설명: ${feature.description ?? ''}`,
      maxOutputTokens: 2000,
    });
    try { return this.parseJSON(text); }
    catch { return [{ _rawText: text, _parseError: true }]; }
  }

  async generateTestScenarios(context: { requirement?: { title: string; description?: string }; feature?: { title: string; description?: string } }): Promise<any[]> {
    const model = await this.getModel();
    const config = await this.adminService.getActiveLLMConfig();
    const { text } = await generateText({
      model,
      system: this.getPrompt(config, 'generateTestScenarios'),
      prompt: `요구사항: ${context.requirement?.title ?? ''}\n기능: ${context.feature?.title ?? ''}\n설명: ${context.requirement?.description ?? context.feature?.description ?? ''}`,
      maxOutputTokens: 2000,
    });
    try { return this.parseJSON(text); }
    catch { return [{ _rawText: text, _parseError: true }]; }
  }

  async suggest(context: string, type: string): Promise<string> {
    const model = await this.getModel();
    const { text } = await generateText({
      model,
      system: `당신은 ${type} 작성을 돕는 전문가입니다. 간결하고 명확하게 제안해주세요.`,
      prompt: context,
      maxOutputTokens: 500,
    });
    return text;
  }

  async isConfigured(): Promise<boolean> {
    const config = await this.adminService.getActiveLLMConfig();
    return !!config;
  }

  async diffSpec(
    existing: { id: string; title: string; description?: string | null; category?: string | null }[],
    newItems: { title: string; description?: string; category?: string; priority?: string; status?: string }[],
  ): Promise<{ type: 'new' | 'changed' | 'unchanged'; item: any; existingId?: string }[]> {
    const result: { type: 'new' | 'changed' | 'unchanged'; item: any; existingId?: string }[] = [];
    for (const n of newItems) {
      const match = existing.find(e =>
        e.title.toLowerCase().trim() === n.title.toLowerCase().trim() ||
        (e.description && n.description && e.description.toLowerCase().includes(n.description.toLowerCase().slice(0, 30)))
      );
      if (!match) {
        result.push({ type: 'new', item: n });
      } else if (match.description !== n.description || match.category !== n.category) {
        result.push({ type: 'changed', item: n, existingId: match.id });
      } else {
        result.push({ type: 'unchanged', item: n, existingId: match.id });
      }
    }
    return result;
  }
}
