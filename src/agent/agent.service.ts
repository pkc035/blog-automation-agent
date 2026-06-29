import { Injectable, OnModuleInit } from '@nestjs/common';
import { StateGraph, END, Annotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { ConfigService } from '@nestjs/config';

// 1. 상태 스키마 선언
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

  constructor(private readonly configService: ConfigService) {
    this.llm = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0.7,
      openAIApiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  onModuleInit() {
    // [해결 치트키 1] 제너릭과 spec을 모두 떼어내고 Annotation 루트 인스턴스를 통째로 삽입
    // [해결 치트키 2] workflow 변수 체인에 as any를 부여하여 Excessive stack depth 에러 원천 봉쇄
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

    // 내부 시작 가상 노드 연결
    workflow.addEdge('__start__', 'collectorNode');

    this.blogGraph = workflow.compile();
  }

  public async generateBlogPost(topic: string, category: 'COUPANG' | 'REAL_ESTATE') {
    const finalState = await this.blogGraph.invoke({
      topic,
      category,
      collectedData: '',
      draft: '',
      critique: '',
      revisionCount: 0,
      isApproved: false,
    });

    return finalState;
  }

  private shouldContinue(state: BlogStateType): string {
    if (state.isApproved || state.revisionCount >= 3) {
      return 'END';
    }
    return 'writerNode';
  }

  private async collectorNode(state: BlogStateType): Promise<Partial<BlogStateType>> {
    const rawData = `[가상 수집 데이터] 주제: ${state.topic}에 대한 최신 뉴스 및 스펙 정보...`;

    return {
      collectedData: rawData,
      revisionCount: 0,
      isApproved: false,
    };
  }

  private async writerNode(state: BlogStateType): Promise<Partial<BlogStateType>> {
    const prompt = `
      너는 전문 IT/부동산 인플루언서 블로거다. 
      아래 [수집된 자료]와 [이전 검수자의 지적사항]을 바탕으로 마크다운 블로그 초안을 작성하라.
      
      [수집된 자료]: ${state.collectedData}
      [지적 사항]: ${state.critique || '없음. 첫 작성임'}
    `;

    const response = await this.llm.invoke(prompt);
    return { draft: response.content as string };
  }

  private async reviewerNode(state: BlogStateType): Promise<Partial<BlogStateType>> {
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
      return { isApproved: true, critique: '완벽합니다.' };
    } else {
      return {
        isApproved: false,
        critique: resultText,
        revisionCount: (state.revisionCount || 0) + 1,
      };
    }
  }
}