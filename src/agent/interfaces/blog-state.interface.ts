export interface BlogAgentState {
  topic: string;           // 유저가 요청한 글 주제
  category: 'COUPANG' | 'REAL_ESTATE';
  collectedData: string;   // Collector가 수집한 팩트 데이터
  draft: string;           // Writer가 쓴 초안
  critique: string;        // Reviewer의 지적 사항 (수정 가이드)
  revisionCount: number;   // 퇴고 반복 횟수 (Max 3회 제한용)
  isApproved: boolean;     // 편집장 최종 승인 여부
}