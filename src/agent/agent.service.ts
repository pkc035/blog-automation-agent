import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { StateGraph, END, Annotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'fs'; 
import { join } from 'path';                 

const BlogAgentAnnotation = Annotation.Root({
  topic: Annotation<string>(),
  category: Annotation<'COUPANG' | 'REAL_ESTATE'>(),
  collectedData: Annotation<string>(),
  draft: Annotation<string>(),
  critique: Annotation<string>(),
  revisionCount: Annotation<number>(),
  isApproved: Annotation<boolean>(),
});

type BlogStateType = typeof BlogAgentAnnotation.State;

@Injectable()
export class AgentService implements OnModuleInit {
  private llm: ChatOpenAI;
  private blogGraph: any;
  private readonly logger = new Logger(AgentService.name);

  constructor(private readonly configService: ConfigService) {
    this.llm = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0.7,
      openAIApiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  onModuleInit() {
    const workflow = new StateGraph(BlogAgentAnnotation) as any;

    workflow
      .addNode('collectorNode', this.collectorNode.bind(this))
      .addNode('writerNode', this.writerNode.bind(this))
      .addNode('reviewerNode', this.reviewerNode.bind(this))
      .addEdge('collectorNode', 'writerNode')
      .addEdge('writerNode', 'reviewerNode')
      .addConditionalEdges(
        'reviewerNode',
        this.shouldContinue.bind(this),
        { END: END, writerNode: 'writerNode' }
      );

    workflow.addEdge('__start__', 'collectorNode');
    this.blogGraph = workflow.compile();
  }

  // =================================================================
  // [NEW] 스마트 프롬프트 로더 (시릿 파일 유무 판별기)
  // =================================================================
  private loadPromptTemplate(type: 'writer' | 'reviewer'): string {
    const promptDir = join(process.cwd(), 'prompts');
    const secretPath = join(promptDir, `${type}.prompt.txt`);
    const examplePath = join(promptDir, `${type}.example.txt`);

    // 1. 진짜 내 비밀 프롬프트 파일이 존재하면 로드
    if (existsSync(secretPath)) {
      return readFileSync(secretPath, 'utf-8');
    }

    // 2. 없으면(깃허브 클론자 등) 공개용 example 템플릿 로드
    if (existsSync(examplePath)) {
      this.logger.warn(`🔓 [PromptLoader] 나만의 '${type}.prompt.txt'가 없어 기본 example 템플릿으로 연산합니다.`);
      return readFileSync(examplePath, 'utf-8');
    }

    throw new Error(`[PromptLoader] '${type}' 프롬프트 파일을 찾을 수 없습니다. prompts 폴더를 확인하세요.`);
  }

  public async generateBlogPost(topic: string, category: 'COUPANG' | 'REAL_ESTATE') {
    this.logger.log(`🚀 [에이전트 구동 시작] 주제: "${topic}" (${category})`);

    const finalState = await this.blogGraph.invoke({
      topic, category, collectedData: '', draft: '', critique: '', revisionCount: 0, isApproved: false,
    });

    this.logger.log(`🏁 [에이전트 프로세스 종료] 최종 승인 여부: ${finalState.isApproved}`);
    return finalState;
  }

  private shouldContinue(state: BlogStateType): string {
    if (state.isApproved) return 'END';
    if (state.revisionCount >= 3) {
      this.logger.error(`💥 [Circuit Breaker 발동] 최대 퇴고 횟수(3회) 초과! 강제 종료합니다.`);
      return 'END';
    }
    this.logger.log(`🔄 [재진입] 지적 사항 반영을 위해 Writer 노드로 복귀합니다.`);
    return 'writerNode';
  }

  // --- 노드 구현체 ---

  private async collectorNode(state: BlogStateType): Promise<Partial<BlogStateType>> {
    this.logger.log(`🔍 [Collector] 기초 데이터 수집 중...`);
    const rawData = `[가상 수집 데이터] 주제: ${state.topic}에 대한 최신 뉴스 및 스펙 정보...`;
    this.logger.log(`🟢 [Collector] 데이터 수집 완료`);
    
    return { collectedData: rawData, revisionCount: 0, isApproved: false };
  }

  // [Writer Node]
  private async writerNode(state: BlogStateType): Promise<Partial<BlogStateType>> {
    const currentAttempt = (state.revisionCount || 0) + 1;
    this.logger.log(`✍️ [Writer] ${currentAttempt}차 초안 작성 중...`);

    // 1. 외부 파일에서 텍스트 읽기
    const rawPrompt = this.loadPromptTemplate('writer');
    
    // 2. 플레이스홀더를 실제 State 값으로 치환 (.replaceAll 사용으로 다중 치환 대응)
    const prompt = rawPrompt
      .replaceAll('{collectedData}', state.collectedData)
      .replaceAll('{critique}', state.critique || '없음. 첫 작성임');

    const response = await this.llm.invoke(prompt);
    this.logger.log(`🟢 [Writer] ${currentAttempt}차 초안 작성 완료!`);

    return { draft: response.content as string };
  }

  // [Reviewer Node]
  private async reviewerNode(state: BlogStateType): Promise<Partial<BlogStateType>> {
    this.logger.log(`🧐 [Reviewer] 초안 SEO 및 톤앤매너 검수 중...`);

    // 1. 외부 파일에서 텍스트 읽기
    const rawPrompt = this.loadPromptTemplate('reviewer');
    
    // 2. 초안 텍스트 주입
    const prompt = rawPrompt.replaceAll('{draft}', state.draft);

    const response = await this.llm.invoke(prompt);
    const resultText = response.content as string;

    if (resultText.includes('PASS')) {
      this.logger.log(`🎉 [Reviewer] PASS 판정 ➔ 최종 승인!`);
      return { isApproved: true, critique: '완벽합니다.' };
    } else {
      const nextCount = (state.revisionCount || 0) + 1;
      this.logger.warn(`⚠️ [Reviewer] 불합격 판정 (퇴고 누적: ${nextCount}/3) ➔ 피드백: "${resultText.replace(/\n/g, ' ').slice(0, 40)}..."`);
      
      return { isApproved: false, critique: resultText, revisionCount: nextCount };
    }
  }
}