# Social Summary Web App — Design Spec
Date: 2026-04-27

## Overview

URL을 입력하면 Twitter, LinkedIn, Thread, Geek News 4개 플랫폼용 요약문을 자동 생성하는 웹앱.

## Character Limits

| Platform  | 글자 수 |
|-----------|---------|
| Twitter   | 250자   |
| Thread    | 500자   |
| LinkedIn  | 800자   |
| Geek News | 1000자  |

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **AI:** Vercel AI SDK (`ai`) — Claude / Gemini / ChatGPT 멀티 제공자 지원
  - Claude: `@ai-sdk/anthropic`
  - Gemini: `@ai-sdk/google`
  - ChatGPT: `@ai-sdk/openai`
- **Content extraction:** `@mozilla/readability` + `jsdom`
- **Styling:** Tailwind CSS
- **Storage:** Browser localStorage (선택 제공자 + API 키 + URL 히스토리)
- **Deployment target:** Vercel

## Architecture & Data Flow

```
[사용자] → 제공자 선택 + API 키 입력 + URL 입력
    ↓
[Next.js Server Action: app/actions/summarize.ts]
    1. fetch(url) → HTML 수신
    2. @mozilla/readability로 본문 텍스트 추출
    3. Vercel AI SDK로 선택된 제공자 API 호출 1번
       — 4개 플랫폼 요약 동시 생성
    4. 결과 반환
    ↓
[클라이언트]
    - 세로 리스트로 결과 표시
    - localStorage에 저장
```

**핵심 결정:**
- URL fetch는 서버에서 수행 (CORS 우회, API 키 보호)
- Vercel AI SDK의 통일된 인터페이스로 제공자 전환 용이
- API 호출 1번에 4개 요약 동시 생성 (비용/속도 최적화)

## File Structure

```
SuperPower01/
├── app/
│   ├── page.tsx                  ← 메인 UI
│   ├── actions/
│   │   └── summarize.ts          ← Server Action
│   └── layout.tsx
├── components/
│   ├── ApiKeyInput.tsx            ← API 키 입력
│   ├── UrlForm.tsx                ← URL 입력 폼
│   └── SummaryCard.tsx           ← 플랫폼별 요약 카드
├── lib/
│   └── extract-content.ts        ← HTML → 본문 텍스트 추출
└── package.json
```

## UI Layout

세로 리스트 방식. 위에서 아래로:

```
┌─────────────────────────────────────┐
│  🔑 Claude API Key                   │
│  [sk-ant-...____________]  👁        │
│  💡 console.anthropic.com 에서 확인  │
├─────────────────────────────────────┤
│  🌐 URL 입력  [__________________]  │
│               [     요약 생성     ] │
├─────────────────────────────────────┤
│  (로딩 스피너)                       │
├─────────────────────────────────────┤
│  🐦 Twitter · 250자                  │
│  [요약 텍스트]            [📋 복사] │
│  ████████░░░░ 187/250자              │
├─────────────────────────────────────┤
│  💼 LinkedIn · 800자                 │
│  [요약 텍스트]            [📋 복사] │
├─────────────────────────────────────┤
│  🧵 Thread · 500자                   │
│  [요약 텍스트]            [📋 복사] │
├─────────────────────────────────────┤
│  🤓 Geek News · 1000자               │
│  [요약 텍스트]            [📋 복사] │
└─────────────────────────────────────┘
```

**UX 세부 사항:**
- AI 제공자 드롭다운: Claude / Gemini / ChatGPT 선택
- API 키: `type="password"` 마스킹, 눈 아이콘으로 토글, localStorage 자동 저장/불러오기
- 제공자별 키 확인 링크 자동 변경:
  - Claude → console.anthropic.com
  - Gemini → aistudio.google.com
  - ChatGPT → platform.openai.com
- 각 카드: 글자 수 표시 + 복사 버튼 (클릭 시 "복사됨!" 피드백)
- 최근 조회 URL 히스토리 localStorage 보관

## Error Handling

| 상황 | 처리 |
|------|------|
| API 키 미입력 | 버튼 비활성화 + "API 키를 입력해주세요" |
| URL fetch 실패 | "해당 페이지를 읽을 수 없습니다. JS 렌더링이 필요한 페이지일 수 있습니다" |
| 본문 추출 실패 | "페이지에서 읽을 수 있는 내용을 찾지 못했습니다" |
| Claude API 오류 | API 응답 에러 메시지 그대로 표시 |
| 네트워크 오류 | "네트워크 오류가 발생했습니다. 다시 시도해주세요" |

## Out of Scope

- 로그인 / 회원가입
- 서버 사이드 히스토리 저장
- JS 렌더링 페이지 지원 (Headless 브라우저)
- 다국어 UI
