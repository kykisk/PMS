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
    let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    cleaned = cleaned.replace(/"([A-Za-z])"\s*\.repeat\(\s*(\d+)\s*\)/g, (_, char, count) => {
      return `"${char.repeat(Math.min(Number(count), 300))}"`;
    });
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

  async parseMarkdown(
    content: string, userId?: string, modelId?: string,
    existingData?: {
      requirements: { id: string; code: string; title: string; description?: string | null }[];
      useCases: { id: string; code: string; title: string; description?: string | null }[];
      userStories: { id: string; code: string; title: string; iWantTo?: string | null }[];
    },
    additionalInfo?: string,
  ): Promise<{ requirements: any[]; useCases: any[]; userStories: any[] }> {
    const model = await this.getModel(userId, modelId);

    const CHUNK_SIZE = 4000;
    const allReqs: any[] = [];
    const allUCs: any[] = [];
    const allUSs: any[] = [];

    const hasExisting = existingData && (existingData.requirements.length + existingData.useCases.length + existingData.userStories.length) > 0;

    const existingSection = hasExisting ? `

=== 기존에 이미 등록된 데이터 (참고용) ===
요구사항: ${existingData!.requirements.map(r => `[${r.code}] ${r.title}`).join(', ') || '없음'}
Use Case: ${existingData!.useCases.map(u => `[${u.code}] ${u.title}`).join(', ') || '없음'}
User Story: ${existingData!.userStories.map(u => `[${u.code}] ${u.title}`).join(', ') || '없음'}` : '';

    const systemPrompt = `당신은 소프트웨어 분석 전문가입니다. 마크다운 문서에서 요구사항, 유스케이스, 사용자 스토리를 동시에 추출해주세요.
${hasExisting ? '\n기존에 등록된 데이터가 있으므로 각 항목에 action을 판단해주세요.' : ''}

출력 형식: JSON 객체 하나
{
  "requirements": [{
    "title": "요구사항명",
    "category": "분류",
    "description": "설명",
    "priority": "high|medium|low",
    "status": "new",
    "action": "new|update|skip",
    "_existingCode": "수정 대상 기존 코드 (action=update일 때만)"
  }],
  "useCases": [{
    "title": "유스케이스명",
    "actor": "주 행위자",
    "description": "목적과 개요",
    "precondition": "사전조건",
    "mainFlow": ["1단계", "2단계"],
    "postcondition": "사후조건",
    "priority": "high|medium|low",
    "linkedRequirementTitle": "연관 요구사항 title (없으면 null)",
    "action": "new|update|skip",
    "_existingCode": "수정 대상 기존 코드 (action=update일 때만)"
  }],
  "userStories": [{
    "title": "스토리 제목",
    "asA": "역할",
    "iWantTo": "원하는 행동",
    "soThat": "목적/이유",
    "acceptanceCriteria": ["조건1"],
    "priority": "high|medium|low",
    "storyPoints": 1,
    "linkedRequirementTitle": "연관 요구사항 title (없으면 null)",
    "action": "new|update|skip",
    "_existingCode": "수정 대상 기존 코드 (action=update일 때만)"
  }]
}

action 판단 기준:
- "new": 기존 목록에 없는 완전히 새로운 내용
- "update": 기존에 비슷한 내용이 있지만 설명/범위가 다르거나 보완 필요
- "skip": 기존에 이미 동일한 내용이 존재
- 기존 데이터가 없으면 모두 "new"

규칙:
- 단순 기술적 사항은 requirements, 상호작용 흐름은 useCases, "~로서 ~하고싶다"는 userStories
- 반드시 유효한 JSON 객체만 출력`;

    const analyzeChunk = async (chunk: string) => {
      const { text } = await generateText({
        model,
        system: systemPrompt,
        prompt: `다음 마크다운 문서에서 요구사항, 유스케이스, 사용자 스토리를 추출해주세요:\n\n${chunk}${existingSection}${additionalInfo ? `\n\n=== 추가 지시사항 ===\n${additionalInfo}` : ''}`,
        maxOutputTokens: 16000,
      });

      try {
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (!match) return;
        const parsed = JSON.parse(match[0]);
        if (parsed.requirements) allReqs.push(...parsed.requirements.map((r: any) => ({
          ...r,
          _existingId: existingData?.requirements.find(e => e.code === r._existingCode)?.id,
        })));
        if (parsed.useCases) allUCs.push(...parsed.useCases.map((u: any) => ({
          ...u,
          _existingId: existingData?.useCases.find(e => e.code === u._existingCode)?.id,
        })));
        if (parsed.userStories) allUSs.push(...parsed.userStories.map((u: any) => ({
          ...u,
          _existingId: existingData?.userStories.find(e => e.code === u._existingCode)?.id,
        })));
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

  async generateFeaturesMulti(requirements: { id: string; code: string; title: string; description?: string | null; category?: string | null }[], userId?: string, modelId?: string, additionalInfo?: string): Promise<any[]> {
    return this.generateFeaturesWithContext(requirements, [], userId, modelId, additionalInfo);
  }

  async generateFeaturesWithContext(
    requirements: { id: string; code: string; title: string; description?: string | null; category?: string | null }[],
    existingFeatures: { id: string; code: string; title: string; description?: string | null; reqId?: string | null }[],
    userId?: string, modelId?: string, additionalInfo?: string,
  ): Promise<any[]> {
    if (requirements.length > 1) {
      const results = await Promise.all(
        requirements.map(req =>
          this.generateFeaturesWithContext([req], existingFeatures, userId, modelId, additionalInfo).catch(() => [])
        )
      );
      return results.flat();
    }

    const model = await this.getModel(userId, modelId);
    const reqList = requirements.map(r => `[${r.code}] ${r.title}${r.category ? ` (분류: ${r.category})` : ''}${r.description ? ` - ${r.description}` : ''}`).join('\n');

    const existingList = existingFeatures.length > 0
      ? `\n\n=== 기존에 이미 등록된 기능 목록 ===\n${existingFeatures.map(f => `[${f.code}] ${f.title}${f.description ? ` - ${f.description}` : ''}`).join('\n')}`
      : '';

    const { text } = await generateText({
      model,
      system: `당신은 소프트웨어 설계 전문가입니다. 요구사항을 분석하여 기능(Feature)을 도출하되, 기존에 이미 등록된 기능 목록이 있으면 이를 참고하여 판단해주세요.
출력 형식: JSON 배열 [{
  "action": "new" | "update" | "skip",
  "title": "기능명",
  "description": "기능 설명",
  "_requirementCode": "연결된 요구사항 코드",
  "_requirementTitle": "연결된 요구사항 제목",
  "_existingFeatureCode": "수정 대상 기존 기능 코드 (action=update일 때만)",
  "_reason": "판단 사유 (skip/update일 때만)"
}]
action 판단 기준:
- "new": 기존 목록에 없는 완전히 새로운 기능 → 신규 추가
- "update": 기존에 비슷한 기능이 있지만 설명이 부족하거나 범위 확장 필요 → 수정 제안
- "skip": 기존에 이미 동일한 기능이 충분히 존재 → 생성 불필요
규칙:
- 하나의 요구사항에서 필요한 만큼 여러 기능을 도출 (1개~10개)
- 복잡한 요구사항은 UI/API/로직/검증 등으로 세분화
- 단순한 요구사항은 1~2개로 충분
- 기존 기능이 없으면 모두 "new"로 출력
- 반드시 유효한 JSON 배열만 출력`,
      prompt: `다음 요구사항들을 분석하여 기능을 도출해주세요:

=== 분석 대상 요구사항 ===
${reqList}${existingList}${additionalInfo ? `\n\n=== 추가 지시사항 ===\n${additionalInfo}` : ''}`,
      maxOutputTokens: 16000,
    });
    try {
      const parsed = this.parseJSON(text);
      return parsed.map((item: any) => {
        const matchReq = requirements.find(r => r.code === item._requirementCode);
        const matchExisting = existingFeatures.find(f => f.code === item._existingFeatureCode);
        return { ...item, _requirementId: matchReq?.id, _existingFeatureId: matchExisting?.id };
      });
    }
    catch { return [{ _rawText: text, _parseError: true }]; }
  }

  async generateTasks(feature: { title: string; description?: string }, userId?: string, modelId?: string, additionalInfo?: string): Promise<any[]> {
    const model = await this.getModel(userId, modelId);
    const config = await this.adminService.getActiveLLMConfig();
    const { text } = await generateText({
      model,
      system: this.getPrompt(config, 'generateTasks'),
      prompt: `기능: ${feature.title}\n설명: ${feature.description ?? ''}${additionalInfo ? `\n\n추가 지시사항:\n${additionalInfo}` : ''}`,
      maxOutputTokens: 8000,
    });
    try { return this.parseJSON(text); }
    catch { return [{ _rawText: text, _parseError: true }]; }
  }

  async generateTestScenarios(context: { requirement?: { title: string; description?: string }; feature?: { title: string; description?: string } }, userId?: string, modelId?: string, additionalInfo?: string, detailLevel?: number): Promise<any[]> {
    const model = await this.getModel(userId, modelId);
    const config = await this.adminService.getActiveLLMConfig();
    const count = detailLevel ?? 5
    const countGuide = count <= 3
      ? `핵심 정상/비정상 케이스만 포함하여 최대 ${count}개 이내로 간략하게`
      : count <= 7
        ? `주요 흐름을 포함하여 ${count}개 내외로`
        : `경계값, 예외, 보안 케이스까지 포함하여 ${count}개 내외로 상세하게`
    const { text } = await generateText({
      model,
      system: this.getPrompt(config, 'generateTestScenarios'),
      prompt: `요구사항: ${context.requirement?.title ?? ''}\n기능: ${context.feature?.title ?? ''}\n설명: ${context.requirement?.description ?? context.feature?.description ?? ''}\n\n[생성 개수 지침] ${countGuide} 시나리오를 도출해주세요.${additionalInfo ? `\n\n추가 지시사항:\n${additionalInfo}` : ''}`,
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

  async generateFeaturesUpdate(
    currentReq: { id: string; title: string; description?: string | null; category?: string | null },
    previousData: { title?: string; description?: string } | null,
    existingFeatures: { id: string; code: string; title: string; description?: string | null }[],
    userId?: string, modelId?: string, additionalInfo?: string,
  ): Promise<any[]> {
    const model = await this.getModel(userId, modelId);
    const changeInfo = previousData
      ? `이전 확정 내용:\n제목: ${previousData.title ?? ''}\n설명: ${previousData.description ?? ''}\n\n현재 확정 내용:\n제목: ${currentReq.title}\n설명: ${currentReq.description ?? ''}`
      : `확정 내용:\n제목: ${currentReq.title}\n설명: ${currentReq.description ?? ''}`;
    const existingList = existingFeatures.length > 0
      ? `\n\n기존 기능 목록:\n${existingFeatures.map(f => `[${f.code}] ${f.title}${f.description ? ` - ${f.description}` : ''}`).join('\n')}`
      : '';
    const { text } = await generateText({
      model,
      system: `당신은 소프트웨어 설계 전문가입니다. 요구사항 변경 내역을 분석하여 기존 기능 목록을 업데이트해주세요.
출력 형식: JSON 배열 [{
  "action": "new|update|skip",
  "title": "기능명",
  "description": "기능 설명",
  "_existingCode": "수정 대상 코드 (action=update일 때만)",
  "_reason": "판단 사유"
}]
판단 기준:
- "new": 변경된 요구사항에서 새로 생긴 기능
- "update": 기존 기능이 있지만 요구사항 변경으로 내용 수정 필요
- "skip": 변경과 무관하게 기존 기능이 여전히 유효
기존 기능이 없으면 요구사항 내용 기반으로 신규 기능만 도출
반드시 유효한 JSON 배열만 출력`,
      prompt: `다음 요구사항 변경을 분석하여 기능을 업데이트해주세요:\n\n${changeInfo}${existingList}${additionalInfo ? `\n\n추가 지시사항:\n${additionalInfo}` : ''}`,
      maxOutputTokens: 8000,
    });
    try {
      const parsed = this.parseJSON(text);
      return parsed.map((item: any) => {
        const matchExisting = existingFeatures.find(f => f.code === item._existingCode);
        return { ...item, _existingFeatureId: matchExisting?.id };
      });
    }
    catch { return [{ _rawText: text, _parseError: true }]; }
  }

  async generateTasksUpdate(
    currentFeature: { id: string; title: string; description?: string | null },
    previousData: { title?: string; description?: string } | null,
    existingTasks: { id: string; code: string; title: string; description?: string | null }[],
    userId?: string, modelId?: string, additionalInfo?: string,
  ): Promise<any[]> {
    const model = await this.getModel(userId, modelId);
    const changeInfo = previousData
      ? `이전 확정 내용:\n제목: ${previousData.title ?? ''}\n설명: ${previousData.description ?? ''}\n\n현재 내용:\n제목: ${currentFeature.title}\n설명: ${currentFeature.description ?? ''}`
      : `기능 내용:\n제목: ${currentFeature.title}\n설명: ${currentFeature.description ?? ''}`;
    const existingList = existingTasks.length > 0
      ? `\n\n기존 Task 목록:\n${existingTasks.map(t => `[${t.code}] ${t.title}${t.description ? ` - ${t.description}` : ''}`).join('\n')}`
      : '';
    const { text } = await generateText({
      model,
      system: `당신은 소프트웨어 개발 전문가입니다. 기능 변경 내역을 분석하여 기존 Task 목록을 업데이트해주세요.
출력 형식: JSON 배열 [{
  "action": "new|update|skip",
  "title": "Task명",
  "description": "Task 설명",
  "_existingCode": "수정 대상 코드 (action=update일 때만)",
  "_reason": "판단 사유"
}]
판단 기준:
- "new": 변경된 기능에서 새로 필요한 Task
- "update": 기존 Task가 있지만 기능 변경으로 내용 수정 필요
- "skip": 변경과 무관하게 기존 Task가 여전히 유효
기존 Task가 없으면 기능 내용 기반으로 신규 Task만 도출
반드시 유효한 JSON 배열만 출력`,
      prompt: `다음 기능 변경을 분석하여 Task를 업데이트해주세요:\n\n${changeInfo}${existingList}${additionalInfo ? `\n\n추가 지시사항:\n${additionalInfo}` : ''}`,
      maxOutputTokens: 8000,
    });
    try {
      const parsed = this.parseJSON(text);
      return parsed.map((item: any) => {
        const matchExisting = existingTasks.find(t => t.code === item._existingCode);
        return { ...item, _existingTaskId: matchExisting?.id };
      });
    }
    catch { return [{ _rawText: text, _parseError: true }]; }
  }

  async generateScenariosUpdate(
    currentFeature: { id: string; title: string; description?: string | null },
    previousData: { title?: string; description?: string } | null,
    existingScenarios: { id: string; code: string; title: string; description?: string | null }[],
    userId?: string, modelId?: string, additionalInfo?: string,
  ): Promise<any[]> {
    const model = await this.getModel(userId, modelId);
    const changeInfo = previousData
      ? `이전 확정 내용:\n제목: ${previousData.title ?? ''}\n설명: ${previousData.description ?? ''}\n\n현재 내용:\n제목: ${currentFeature.title}\n설명: ${currentFeature.description ?? ''}`
      : `기능 내용:\n제목: ${currentFeature.title}\n설명: ${currentFeature.description ?? ''}`;
    const existingList = existingScenarios.length > 0
      ? `\n\n기존 테스트 시나리오 목록:\n${existingScenarios.map(s => `[${s.code}] ${s.title}${s.description ? ` - ${s.description}` : ''}`).join('\n')}`
      : '';
    const { text } = await generateText({
      model,
      system: `당신은 QA 전문가입니다. 기능 변경 내역을 분석하여 기존 테스트 시나리오 목록을 업데이트해주세요.
출력 형식: JSON 배열 [{
  "action": "new|update|skip",
  "title": "시나리오명",
  "description": "시나리오 설명",
  "_existingCode": "수정 대상 코드 (action=update일 때만)",
  "_reason": "판단 사유"
}]
판단 기준:
- "new": 변경된 기능에서 새로 필요한 테스트 시나리오
- "update": 기존 시나리오가 있지만 기능 변경으로 내용 수정 필요
- "skip": 변경과 무관하게 기존 시나리오가 여전히 유효
기존 시나리오가 없으면 기능 내용 기반으로 신규 시나리오만 도출
반드시 유효한 JSON 배열만 출력`,
      prompt: `다음 기능 변경을 분석하여 테스트 시나리오를 업데이트해주세요:\n\n${changeInfo}${existingList}${additionalInfo ? `\n\n추가 지시사항:\n${additionalInfo}` : ''}`,
      maxOutputTokens: 8000,
    });
    try {
      const parsed = this.parseJSON(text);
      return parsed.map((item: any) => {
        const matchExisting = existingScenarios.find(s => s.code === item._existingCode);
        return { ...item, _existingScenarioId: matchExisting?.id };
      });
    }
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

  async generateTestScenariosByLevel(
    feature: { title: string; description?: string },
    levels: string[],
    testType: string,
    userId?: string,
    modelId?: string,
    additionalInfo?: string,
  ): Promise<any[]> {
    const levelPrompts: Record<string, string> = {
      unit: '개별 함수/메서드/모듈 단위 테스트 관점. 입력값 경계, null 처리, 예외 케이스 중심으로 시나리오를 도출하세요.',
      integration: '모듈 간 인터페이스, API 연동, 데이터 흐름 테스트 관점으로 시나리오를 도출하세요.',
      system: '전체 시스템 관점에서 E2E 사용자 워크플로우와 요구사항 충족 여부를 검증하는 시나리오를 도출하세요.',
      acceptance: '고객/사용자 비즈니스 요구사항 충족 여부를 판단하는 인수 기준 시나리오를 도출하세요.',
    };
    const results = await Promise.all(
      levels.map(async (level) => {
        const model = await this.getModel(userId, modelId);
        const levelGuide = levelPrompts[level] ?? '테스트 시나리오를 도출하세요.';
        const { text } = await generateText({
          model,
          system: `당신은 소프트웨어 테스트 전문가입니다. 다음 기능에 대한 테스트 시나리오를 도출하세요.
테스트 레벨: ${level} - ${levelGuide}
테스트 유형: ${testType}
출력 형식: JSON 배열 [{"title": "시나리오명", "description": "시나리오 설명", "type": "${level}", "testType": "${testType}"}]
반드시 유효한 JSON 배열만 출력`,
          prompt: `기능: ${feature.title}\n설명: ${feature.description ?? ''}${additionalInfo ? `\n\n추가 지시사항:\n${additionalInfo}` : ''}`,
          maxOutputTokens: 8000,
        });
        try {
          const parsed = this.parseJSON(text);
          return (parsed as any[]).map(item => ({ ...item, type: level, testType }));
        } catch { return []; }
      })
    );
    return results.flat();
  }

  async generateTestCases(
    scenario: { title: string; description?: string; type?: string },
    userId?: string,
    modelId?: string,
    additionalInfo?: string,
  ): Promise<any[]> {
    const model = await this.getModel(userId, modelId);
    const { text } = await generateText({
      model,
      system: `당신은 소프트웨어 QA 전문가입니다. 테스트 시나리오에서 구체적인 테스트 케이스를 도출하세요.
출력 형식: JSON 배열 [{
  "title": "케이스명",
  "priority": "high|medium|low",
  "steps": ["단계1", "단계2", "단계3"],
  "testData": "입력 데이터",
  "expected": "기대 결과"
}]
4~8개의 케이스를 도출하세요: 정상 케이스, 예외 케이스, 경계값 케이스, 에러 케이스 포함
반드시 유효한 JSON 배열만 출력`,
      prompt: `시나리오: ${scenario.title}\n설명: ${scenario.description ?? ''}\n레벨: ${scenario.type ?? 'integration'}${additionalInfo ? `\n\n추가 지시사항:\n${additionalInfo}` : ''}`,
      maxOutputTokens: 8000,
    });
    try { return this.parseJSON(text); }
    catch { return [{ _rawText: text, _parseError: true }]; }
  }

  async classifyDefect(
    context: { testCaseTitle: string; expected?: string; actual?: string },
    userId?: string,
    modelId?: string,
  ): Promise<{ severity: string; priority: string; reason: string }> {
    const model = await this.getModel(userId, modelId);
    const { text } = await generateText({
      model,
      system: `당신은 소프트웨어 QA 전문가입니다. 테스트 실패 내용을 분석하여 결함의 심각도와 우선순위를 제안하세요.
출력 형식: JSON 객체 {"severity": "critical|major|minor|trivial", "priority": "high|medium|low", "reason": "판단 근거"}
반드시 유효한 JSON 객체만 출력`,
      prompt: `테스트 케이스: ${context.testCaseTitle}\n기대 결과: ${context.expected ?? '미입력'}\n실제 결과: ${context.actual ?? '미입력'}`,
      maxOutputTokens: 500,
    });
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch {}
    return { severity: 'major', priority: 'medium', reason: '자동 분류 실패 - 기본값 적용' };
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
