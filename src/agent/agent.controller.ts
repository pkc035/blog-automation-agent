import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AgentService } from './agent.service';

@Controller('blog')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generatePost(
    @Body('topic') topic: string,
    @Body('category') category: 'COUPANG' | 'REAL_ESTATE',
  ) {
    // 에이전트 서비스 호출 및 최종 상태 반환
    const result = await this.agentService.generateBlogPost(topic, category);
    
    return {
      success: true,
      data: {
        draft: result.draft,
        revisionCount: result.revisionCount,
        isApproved: result.isApproved,
        critique: result.critique,
      },
    };
  }
}