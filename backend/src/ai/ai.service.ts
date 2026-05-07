import { Injectable, BadRequestException } from '@nestjs/common';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { AdminService } from '../admin/admin.service';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_PROMPTS = {
  parseSpec: `당신은 요구사항 분석 전문가입니다. 고객이 제출한 요구사항 기술서를 분석하여 정제된 요구사항 정의서를 만들어주세요.
입력 형식: JSON 배열 [{요구사항구분, 요청사항, 상세내용}]
출력 형식: JSON 배열 [{title, category, description, priority, status}]
- priority: "high" | "medium" | "low"
- status: "new"
- 반드시 유효한 JSON만 출력하세요. 다른 텍스트 없이 JSON만.`,

  parseMarkdown: `당신은 요구사항 분석 전문가입니다. 마크다운 문서에서 **모든** 요구사항을 빠짐없이 추출해주세요.
문서의 각 섹션, 기능 설명, 목록 항목을 분석하여 개별 요구사항으로 분리합니다.
출력 형식: JSON 배열 [{title, category, description, priority, status}]
- title: 요구사항의 명확한 제목 (한 문장)
- category: 문서의 섹션명 또는 기능 분류
- description: 구체적인 요구사항 설명 (2-3문장)
- priority: "high" | "medium" | "low"  
- status: "new"
- 최대한 많이 추출하세요. 하나의 기능 설명에 여러 요구사항이 포함되면 분리하세요.
- 반드시 유효한 JSON만 출력하세요. 다른 텍스트 없이 JSON 배열만.`,

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
  constructor(private adminService: AdminService, private prisma: PrismaService) {}

  private createModelFromConfig(config: { provider: string; model: string; apiKey: string; region?: string | null }) {
    switch (config.provider) {
      case 'openai': return createOpenAI({ apiKey: config.apiKey })(config.model);
      case 'anthropic': return createAnthropic({ apiKey: config.apiKey })(config.model);
      case 'gemini': return createGoogleGenerativeAI({ apiKey: config.apiKey })(config.model);
      case 'bedrock': {
        const [accessKeyId, secretAccessKey] = config.apiKey.includes(':')
          ? config.apiKey.split(':') : [config.apiKey, ''];
        return createAmazonBedrock({
          region: config.region ?? 'us-east-1',
          accessKeyId,
          secretAccessKey,
        })(config.model);
      }
      default: throw new BadRequestException(`지원하지 않는 프로바이더: ${config.provider}`);
    }
  }

  private async getModel(userId?: string, modelId?: string) {
    if (modelId) {
      const personal = await this.prisma.userLLMConfig.findFirst({ where: { id: modelId } });
      if (personal) return this.createModelFromConfig(personal);
      const shared = await this.prisma.lLMConfig.findFirst({ where: { id: modelId } });
      if (shared) return this.createModelFromConfig(shared);
    }

    if (userId) {
      const personal = await this.prisma.userLLMConfig.findFirst({ where: { userId, isActive: true } });
      if (personal) return this.createModelFromConfig(personal);

      const accesses = await this.prisma.userLLMAccess.findMany({
        where: { userId },
        include: { llmConfig: true },
        orderBy: { grantedAt: 'desc' },
      });
      for (const access of accesses) {
        if (access.llmConfig?.isActive) return this.createModelFromConfig(access.llmConfig);
      }
    }

    const configs = await this.prisma.lLMConfig.findMany({ where: { isActive: true }, orderBy: { updatedAt: 'desc' } });
    if (configs.length === 0) throw new BadRequestException('LLM 설정이 없습니다. 관리자에게 LLM 설정을 요청하세요.');
    return this.createModelFromConfig(configs[0]);
  }

  async getAvailableModels(userId?: string) {
    const models: { id: string; label: string; type: 'personal' | 'shared' | 'global' }[] = [];

    if (userId) {
      const personal = await this.prisma.userLLMConfig.findMany({ where: { userId, isActive: true }, select: { id: true, provider: true, model: true } });
      personal.forEach(p => models.push({ id: p.id, label: `${p.provider} / ${p.model} (개인)`, type: 'personal' }));

      const access = await this.prisma.userLLMAccess.findMany({
        where: { userId },
        include: { llmConfig: { select: { id: true, provider: true, model: true, isActive: true } } },
      });
      access.filter(a => a.llmConfig.isActive).forEach(a => models.push({ id: a.llmConfig.id, label: `${a.llmConfig.provider} / ${a.llmConfig.model} (공용)`, type: 'shared' }));
    }

    const globals = await this.prisma.lLMConfig.findMany({ where: { isActive: true }, select: { id: true, provider: true, model: true } });
    globals.forEach(g => { if (!models.find(m => m.id === g.id)) models.push({ id: g.id, label: `${g.provider} / ${g.model} (공용)`, type: 'global' }) });

    return models;
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

  async parseSpec(rows: { 요구사항구분?: string; 요청사항?: string; 상세내용?: string }[], userId?: string, modelId?: string): Promise<any[]> {
    const model = await this.getModel(userId, modelId);
    const config = await this.adminService.getActiveLLMConfig();
    const systemPrompt = this.getPrompt(config, 'parseSpec');
    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: `다음 요구사항 기술서를 분석해주세요:\n${JSON.stringify(rows, null, 2)}`,
      maxOutputTokens: 16000,
    });
    try { return this.parseJSON(text); }
    catch { return [{ _rawText: text, _parseError: true }]; }
  }

  async parseMarkdown(content: string, userId?: string, modelId?: string): Promise<{ requirements: any[]; useCases: any[]; userStories: any[] }> {
    const model = await this.getModel(userId, modelId);
    const config = await this.adminService.getActiveLLMConfig();

    const CHUNK_SIZE = 4000;
    const allReqs: any[] = [];
    const allUCs: any[] = [];
    const allUSs: any[] = [];

    const analyzeChunk = async (chunk: string) => {
      const { text } = await generateText({
        model,
        system: `당신은 소프트웨어 분석 전문가입니다. 마크다운 문서에서 요구사항, 유스케이스, 사용자 스토리를 동시에 추출해주세요.

출력 형식: JSON 객체 하나
{
  "requirements": [{
    "title": "요구사항명",
    "category": "분류",
    "description": "설명",
    "priority": "high|medium|low",
    "status": "new"
  }],
  "useCases": [{
    "title": "유스케이스명",
    "actor": "주 행위자 (예: 부모, 관리자, 시스템)",
    "description": "목적과 개요",
    "precondition": "사전조건",
    "mainFlow": ["1단계", "2단계", "3단계"],
    "postcondition": "사후조건",
    "priority": "high|medium|low",
    "linkedRequirementTitle": "이 유스케이스와 가장 관련된 requirements의 title (없으면 null)"
  }],
  "userStories": [{
    "title": "스토리 제목",
    "asA": "역할 (예: 부모, 관리자)",
    "iWantTo": "원하는 행동",
    "soThat": "목적/이유",
    "acceptanceCriteria": ["조건1", "조건2"],
    "priority": "high|medium|low",
    "storyPoints": 1,
    "linkedRequirementTitle": "이 스토리와 가장 관련된 requirements의 title (없으면 null)"
  }]
}

규칙:
- 단순 기술적 사항은 requirements로
- 사용자-시스템 간 상호작용 흐름은 useCases로
- "~로서 ~하고싶다" 형태로 표현 가능하면 userStories로
- 중복 추출 금지 (하나의 내용은 가장 적합한 타입 하나로만)
- linkedRequirementTitle: 같은 문서에서 추출된 requirements 중 가장 연관성 높은 것의 title을 정확히 기입
- 반드시 유효한 JSON 객체만 출력 (다른 텍스트 없이)`,
        prompt: `다음 마크다운 문서에서 요구사항, 유스케이스, 사용자 스토리를 추출해주세요:\n\n${chunk}`,
        maxOutputTokens: 16000,
      });

      try {
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (!match) return;
        const parsed = JSON.parse(match[0]);
        if (parsed.requirements) allReqs.push(...parsed.requirements);
        if (parsed.useCases) allUCs.push(...parsed.useCases);
        if (parsed.userStories) allUSs.push(...parsed.userStories);
      } catch {}
    };

    if (content.length <= CHUNK_SIZE) {
      await analyzeChunk(content);
    } else {
      const sections = content.split(/(?=^## )/m).filter(s => s.trim());
      const chunks: string[] = [];
      let current = '';
      for (const section of sections) {
        if ((current + section).length > CHUNK_SIZE && current) {
          chunks.push(current);
          current = section;
        } else {
          current += section;
        }
      }
      if (current) chunks.push(current);
      for (const chunk of chunks) await analyzeChunk(chunk);
    }

    return { requirements: allReqs, useCases: allUCs, userStories: allUSs };
  }

  async generateFeatures(requirement: { title: string; description?: string; category?: string }, userId?: string, modelId?: string): Promise<any[]> {
    const model = await this.getModel(userId, modelId);
    const config = await this.adminService.getActiveLLMConfig();
    const { text } = await generateText({
      model,
      system: this.getPrompt(config, 'generateFeatures'),
      prompt: `요구사항: ${requirement.title}\n분류: ${requirement.category ?? ''}\n설명: ${requirement.description ?? ''}`,
      maxOutputTokens: 8000,
    });
    try { return this.parseJSON(text); }
    catch { return [{ _rawText: text, _parseError: true }]; }
  }

  async generateTasks(feature: { title: string; description?: string }, userId?: string, modelId?: string): Promise<any[]> {
    const model = await this.getModel(userId, modelId);
    const config = await this.adminService.getActiveLLMConfig();
    const { text } = await generateText({
      model,
      system: this.getPrompt(config, 'generateTasks'),
      prompt: `기능: ${feature.title}\n설명: ${feature.description ?? ''}`,
      maxOutputTokens: 8000,
    });
    try { return this.parseJSON(text); }
    catch { return [{ _rawText: text, _parseError: true }]; }
  }

  async generateTestScenarios(context: { requirement?: { title: string; description?: string }; feature?: { title: string; description?: string } }, userId?: string, modelId?: string): Promise<any[]> {
    const model = await this.getModel(userId, modelId);
    const config = await this.adminService.getActiveLLMConfig();
    const { text } = await generateText({
      model,
      system: this.getPrompt(config, 'generateTestScenarios'),
      prompt: `요구사항: ${context.requirement?.title ?? ''}\n기능: ${context.feature?.title ?? ''}\n설명: ${context.requirement?.description ?? context.feature?.description ?? ''}`,
      maxOutputTokens: 8000,
    });
    try { return this.parseJSON(text); }
    catch { return [{ _rawText: text, _parseError: true }]; }
  }

  async generateDbDesign(features: any[], requirements: any[], userId?: string, modelId?: string): Promise<any[]> {
    const model = await this.getModel(userId, modelId);
    const featureList = features.map(f => `- ${f.code}: ${f.title} (요구사항: ${f.requirement?.title ?? '없음'})`).join('\n');
    const { text } = await generateText({
      model,
      system: `당신은 데이터베이스 설계 전문가입니다. 주어진 기능 목록을 분석하여 필요한 DB 테이블을 설계해주세요.
출력 형식: JSON 배열 [{
  "name": "테이블명(영문_스네이크케이스)",
  "description": "테이블 설명",
  "featureTitle": "관련 기능명 (없으면 null)",
  "columns": [{"name": "컬럼명", "type": "VARCHAR(255)|INT|TEXT|BOOLEAN|TIMESTAMP|UUID", "nullable": true|false, "primaryKey": true|false, "foreignKey": "참조테이블.컬럼 또는 null", "description": "설명"}],
  "indexes": [{"name": "인덱스명", "columns": ["컬럼명"], "unique": true|false}]
}]
- 중복 테이블 생성 금지 (예: User 테이블이 이미 있으면 다시 생성하지 않음)
- 단순 UI 표시 기능은 DB 테이블 불필요
- 반드시 유효한 JSON 배열만 출력`,
      prompt: `다음 기능 목록을 분석하여 필요한 DB 테이블을 설계해주세요:\n\n${featureList}`,
      maxOutputTokens: 16000,
    });
    try { return this.parseJSON(text); }
    catch { return [{ _rawText: text, _parseError: true }]; }
  }

  async generateApiDesign(features: any[], requirements: any[], userId?: string, modelId?: string): Promise<any[]> {
    const model = await this.getModel(userId, modelId);
    const featureList = features.map(f => `- ${f.code}: ${f.title} (요구사항: ${f.requirement?.title ?? '없음'})`).join('\n');
    const { text } = await generateText({
      model,
      system: `당신은 REST API 설계 전문가입니다. 주어진 기능 목록을 분석하여 필요한 API 명세를 설계해주세요.
출력 형식: JSON 배열 [{
  "method": "GET|POST|PUT|DELETE|PATCH",
  "path": "/api/v1/...",
  "summary": "API 요약",
  "description": "상세 설명",
  "featureTitle": "관련 기능명",
  "parameters": [{"name": "파라미터명", "in": "path|query|header", "required": true|false, "type": "string|number|boolean", "description": "설명"}],
  "requestBody": {"contentType": "application/json", "schema": {"필드명": {"type": "타입", "required": true|false, "description": "설명"}}},
  "responseBody": {"200": {"description": "성공", "schema": {"필드명": "타입"}}},
  "statusCodes": [{"code": 200, "description": "성공"}, {"code": 400, "description": "잘못된 요청"}]
}]
- RESTful 원칙 준수
- CRUD 기능은 GET/POST/PUT/DELETE 4개 생성
- 단순 UI 표시는 GET 1개
- 반드시 유효한 JSON 배열만 출력`,
      prompt: `다음 기능 목록을 분석하여 REST API 명세를 설계해주세요:\n\n${featureList}`,
      maxOutputTokens: 16000,
    });
    try { return this.parseJSON(text); }
    catch { return [{ _rawText: text, _parseError: true }]; }
  }

  async suggest(context: string, type: string, userId?: string, modelId?: string): Promise<string> {
    const model = await this.getModel(userId, modelId);
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
