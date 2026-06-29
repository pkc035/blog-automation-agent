import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { StateGraph, END, Annotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { ConfigService } from '@nestjs/config';

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
        {
          END: END,
          writerNode: 'writerNode',
        }
      );

    workflow.addEdge('__start__', 'collectorNode');
    this.blogGraph = workflow.compile();
  }

  public async generateBlogPost(topic: string, category: 'COUPANG' | 'REAL_ESTATE') {
    this.logger.log(`🚀 [에이전트 구동 시작] 주제: "${topic}" (${category})`);

    const finalState = await this.blogGraph.invoke({
      topic,
      category,
      collectedData: '',
      draft: '',
      critique: '',
      revisionCount: 0,
      isApproved: false,
    });

    this.logger.log(`🏁 [에이전트 프로세스 종료] 최종 승인 여부: ${finalState.isApproved}`);
    return finalState;
  }

  // =================================================================
  // 조건부 분기 판단 로거
  // =================================================================
  private shouldContinue(state: BlogStateType): string {
    if (state.isApproved) {
      return 'END';
    }
    if (state.revisionCount >= 3) {
      this.logger.error(`💥 [Circuit Breaker 발동] 최대 퇴고 횟수(3회) 초과! 강제 종료합니다.`);
      return 'END';
    }
    
    this.logger.log(`🔄 [재진입] 지적 사항 반영을 위해 Writer 노드로 복귀합니다.`);
    return 'writerNode';
  }

  // =================================================================
  // 각 노드별 중계 로거
  // =================================================================

  private async collectorNode(state: BlogStateType): Promise<Partial<BlogStateType>> {
    this.logger.log(`🔍 [Collector] 기초 데이터 수집 중...`);
    const rawData = `[가상 수집 데이터] 주제: ${state.topic}에 대한 최신 뉴스 및 스펙 정보...`;
    
    this.logger.log(`🟢 [Collector] 데이터 수집 완료`);
    return {
      collectedData: rawData,
      revisionCount: 0,
      isApproved: false,
    };
  }

  private async writerNode(state: BlogStateType): Promise<Partial<BlogStateType>> {
    // 현재 회차 계산 (0이면 1차, 1이면 2차...)
    const currentAttempt = (state.revisionCount || 0) + 1;
    this.logger.log(`✍️ [Writer] ${currentAttempt}차 초안 작성 중...`);

    const prompt = `
      너는 전문 IT/부동산 인플루언서 블로거다. 
      아래 [수집된 자료]와 [이전 검수자의 지적사항]을 바탕으로 마크다운 블로그 초안을 작성하라.
      
      [수집된 자료]: ${state.collectedData}
      [지적 사항]: ${state.critique || '없음. 첫 작성임'}
    `;

    const response = await this.llm.invoke(prompt);
    this.logger.log(`🟢 [Writer] ${currentAttempt}차 초안 작성 완료!`);
    
    return { draft: response.content as string };
  }

  private async reviewerNode(state: BlogStateType): Promise<Partial<BlogStateType>> {
    this.logger.log(`🧐 [Reviewer] 초안 SEO 및 톤앤매너 검수 중...`);

    const prompt = `
      너는 네이버 블로그 SEO 전문가다. 아래 초안을 평가하라.
      1. 자연스러운 구어체인가?
      2. 소제목이 잘 분리되어 있는가?
      
      합격이면 "PASS", 불합격이면 지적할 내용을 구체적으로 작성하라.
      [초안]: ${state.draft}
    `;

    const response = await this.llm.invoke(prompt);
    const resultText = response.content as string;

    if (resultText.includes('PASS')) {
      this.logger.log(`🎉 [Reviewer] PASS 판정 ➔ 최종 승인!`);
      return { isApproved: true, critique: '완벽합니다.' };
    } else {
      const nextCount = (state.revisionCount || 0) + 1;
      // 노란색 경고 로그(warn)로 불합격 사유 출력
      this.logger.warn(`⚠️ [Reviewer] 불합격 판정 (퇴고 누적: ${nextCount}/3) ➔ 피드백: "${resultText.replace(/\n/g, ' ').slice(0, 40)}..."`);
      
      return {
        isApproved: false,
        critique: resultText,
        revisionCount: nextCount,
      };
    }
  }
}