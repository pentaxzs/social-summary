# Instagram w/photo 기능 설계

## 개요

기존 `[Instagram]` (텍스트 카드) 옵션에 더해 `[Instagram w/photo]` 옵션을 추가한다. 각 슬라이드에 고유 배경 사진을 넣어 포토 카드 캐러셀을 생성하는 기능이다.

## 플랫폼 선택 변경

- 기존 `instagram` 하나를 `instagram` (텍스트)과 `instagramPhoto` (포토) 두 개로 분리
- 버튼 라벨: `Instagram` / `Instagram w/photo`
- 둘 다 독립적으로 선택 가능, 각각 별도 결과 생성
- `instagramPhoto`는 fuchsia 계열 스타일 유지하되 기존 instagram과 구분되는 스타일 적용

## 이미지 소싱 체인

슬라이드별로 다음 순서로 이미지를 확보한다:

1. **기사 본문 이미지 추출** — og:image, 본문 `<img>` 태그에서 수집. 기존 `extractContent()` 함수를 확장하여 이미지 URL 배열도 반환.
2. **Unsplash 검색** — 슬라이드의 키워드/헤드라인을 검색어로 사용하여 관련 이미지 검색. Unsplash API 사용.
3. **AI 이미지 생성 (GPT Image, gpt-image-1)** — 1, 2로 부족한 슬라이드에 대해 슬라이드 내용 기반 프롬프트로 이미지 생성. OpenAI Images API 사용.

Outro 슬라이드는 이미지 소싱 대상에서 제외 (기존 그라데이션 스타일 유지).

## API 키 관리

- `[Instagram w/photo]` 선택 시에만 추가 입력 필드를 조건부 노출:
  - **Unsplash Access Key** — Unsplash API 호출용
  - **OpenAI API Key** (이미지 생성용) — 현재 provider가 OpenAI이고 키가 이미 입력되어 있으면 해당 키를 재활용, 아니면 별도 입력
- 모든 키는 localStorage에 저장, 한번 입력하면 이후 자동 적용
- localStorage 키: `unsplash_api_key`, `openai_image_api_key`

## 슬라이드 레이아웃

레퍼런스(AIMing 스타일) 기반:

### 커버 (1번 슬라이드)
- 전체 배경 사진 (1080x1080)
- 하단에 큰 헤드라인 2줄 (1줄: 흰색 볼드, 2줄: accent color 볼드)
- 우상단 슬라이드 카운터 (pill badge)
- 워터마크 없음

### 콘텐츠 (중간 슬라이드)
- 전체 배경 사진 + 어두운 반투명 scrim 오버레이
- 중앙 정렬: emoji + 헤드라인 (볼드 흰색) + 본문 (밝은 회색, 작게, 센터 정렬)
- 우상단 슬라이드 카운터

### 통계 (stat 슬라이드)
- 전체 배경 사진 + 어두운 scrim
- 큰 숫자 + 단위 (accent color)
- 헤드라인 + 출처
- 우상단 슬라이드 카운터

### Outro (마지막 슬라이드)
- 사진 배경 없음, 기존 그라데이션 스타일 유지
- "NEWSLETTER / 메이커스노트 / makersnote.co.kr" 하드코딩 콘텐츠 유지

## 타입 정의 변경

```typescript
// lib/types.ts
export type Platform = 'twitter' | 'thread' | 'linkedin' | 'geekNews' | 'instagram' | 'instagramPhoto';

export interface InstagramPhotoSlide extends InstagramSlide {
  image_url: string; // 슬라이드 배경 이미지 URL
}

export interface InstagramPhotoPost {
  title: string;
  slides: InstagramPhotoSlide[];
  caption: string;
}
```

## 데이터 흐름

1. 사용자가 URL 입력 + `instagramPhoto` 선택 + 제출
2. `extractContent()` 확장 — 본문 텍스트 + 본문 이미지 URL 배열 반환
3. AI가 슬라이드 텍스트 생성 (기존 INSTAGRAM_PROMPT 재활용)
4. 슬라이드 텍스트 생성 완료 후, 각 슬라이드에 이미지 매칭:
   - 추출한 기사 이미지가 있으면 우선 배분
   - 부족한 슬라이드는 Unsplash API로 키워드 검색
   - Unsplash에서도 못 찾으면 GPT Image로 생성
   - Outro 슬라이드는 이미지 매칭 제외
5. 결과를 `InstagramPhotoCard` 컴포넌트로 렌더링

## 컴포넌트 구조

- `InstagramPhotoCard` — 새 컴포넌트 (components/InstagramPhotoCard.tsx)
  - 사진 배경 + scrim + 텍스트 오버레이 렌더링
  - Canvas 다운로드: 배경에 이미지 draw → scrim → 텍스트
  - 슬라이드 네비게이션, 개별/전체 다운로드, 캡션 복사 (기존 InstagramCard와 동일한 UX)
- 기존 `InstagramCard`는 변경 없이 유지

## Server Action 변경

```typescript
// app/actions/summarize.ts

// summarizeUrl 함수 시그니처 확장
export async function summarizeUrl(
  url: string,
  provider: Provider,
  apiKey: string,
  selectedPlatforms: Platform[],
  unsplashKey?: string,
  openaiImageKey?: string,
): Promise<SummarizeResponse>

// 새 함수들
async function extractImages(url: string): Promise<string[]>
async function searchUnsplash(query: string, accessKey: string): Promise<string | null>
async function generateImage(prompt: string, apiKey: string): Promise<string | null>
async function assignImagesToSlides(
  slides: InstagramSlide[],
  articleImages: string[],
  unsplashKey?: string,
  openaiKey?: string,
): Promise<InstagramPhotoSlide[]>
```

## 결과 표시

- page.tsx에서 `instagramPhotoPost` 상태 추가
- `submittedPlatforms.has('instagramPhoto')` 조건으로 `InstagramPhotoCard` 렌더링
- 기존 `instagramPost` / `InstagramCard`와 독립적으로 표시
