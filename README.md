# LangGraph 기반 블로그 콘텐츠 자동 생성 파이프라인

이 프로젝트는 NestJS 환경에서 **LangGraph**를 활용한 다중 에이전트 워크플로우를 구축하여, SEO에 최적화된 블로그 포스팅을 자동 생성하는 시스템입니다.

## 🚀 프로젝트 시리즈

* **[Part 1] 프로젝트 개요 및 아키텍처 설계**: 전체 에이전트 시스템의 동작 원리와 데이터 흐름 설계.
* **[Part 2] Docker 기반 개발 환경 세팅**: NestJS 기반 백엔드 환경 구축 및 컨테이너화.
* **[Part 3] LangGraph 다중 에이전트 구현**: Collector, Writer, Reviewer 에이전트 간의 상태 그래프(StateGraph) 워크플로우 구현.

## 🏗️ 아키텍처 구성

본 시스템은 **State-based Workflow**를 통해 에이전트 간의 상태를 공유하고 순환 루프를 통해 완성도 높은 콘텐츠를 생성합니다.

1. **Collector Node**: 특정 주제와 관련된 기초 데이터 수집.
2. **Writer Node**: 수집된 데이터를 바탕으로 블로그 초안 작성.
3. **Reviewer Node**: SEO 및 톤앤매너 검수 후 승인 또는 퇴고(Circuit Breaker 로직 포함).

## 🛠 주요 기술 스택

* **Framework**: NestJS
* **AI Orchestration**: LangGraph (StateGraph 기반 순환 워크플로우)
* **LLM**: OpenAI (gpt-4o-mini)
* **Container**: Docker Compose를 이용한 개발 환경 격리

## 🚦 향후 계획

* **Part 4**: RAG(검색 증강 생성) 파이프라인 구축 및 과거 블로그 데이터 기반의 문체(Tone & Manner) 학습.
* **Part 5**: RSS Feed 연동을 통한 실시간 데이터 수집 및 성과 데이터(조회수 등) 분석 파이프라인 구축.
* **Part 6**: 배포 환경(Cloud) 세팅 및 파이프라인 자동화.

---

*본 프로젝트는 개인 블로그 운영 효율화를 목표로 진행되는 자동화 연구 프로젝트입니다.*
