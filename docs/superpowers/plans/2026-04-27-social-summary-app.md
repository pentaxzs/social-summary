# Social Summary Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** URL을 입력하면 Twitter(250자), Thread(500자), LinkedIn(800자), Geek News(1000자) 4개 플랫폼용 요약문을 AI로 생성하는 Next.js 웹앱.

**Architecture:** Next.js 15 App Router + Server Action으로 URL fetch 및 AI 호출을 서버에서 처리. Vercel AI SDK의 통일 인터페이스로 Claude/Gemini/ChatGPT 중 사용자가 선택한 제공자를 호출. API 키와 히스토리는 브라우저 localStorage에만 저장.

**Tech Stack:** Next.js 15, Vercel AI SDK (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/openai`), `@mozilla/readability`, `jsdom`, Tailwind CSS

---

## File Map

| File | Role |
|------|------|
| `app/layout.tsx` | 루트 레이아웃 |
| `app/page.tsx` | 메인 UI — 컴포넌트 조립 |
| `app/actions/summarize.ts` | Server Action — URL fetch + AI 요약 |
| `lib/extract-content.ts` | HTML → 본문 텍스트 추출 (Readability) |
| `components/ApiKeyInput.tsx` | 제공자 선택 + API 키 입력 + localStorage |
| `components/UrlForm.tsx` | URL 입력 폼 + 제출 버튼 |
| `components/SummaryCard.tsx` | 플랫폼별 요약 카드 (글자 수 + 복사) |
| `lib/types.ts` | 공유 타입 정의 |

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json` (via create-next-app)
- Create: `lib/types.ts`

- [ ] **Step 1: 프로젝트 생성**

```bash
cd /Users/kenny/Documents/VisualStudio_CCode/SuperPower01
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --no-import-alias --yes
```

Expected: Next.js 15 프로젝트 생성 완료

- [ ] **Step 2: AI SDK 및 콘텐츠 추출 패키지 설치**

```bash
npm install ai @ai-sdk/anthropic @ai-sdk/google @ai-sdk/openai @mozilla/readability jsdom
npm install -D @types/jsdom
```

- [ ] **Step 3: 공유 타입 정의 작성**

`lib/types.ts` 생성:

```typescript
export type Provider = 'anthropic' | 'google' | 'openai';

export interface ProviderConfig {
  label: string;
  keyPlaceholder: string;
  keyHelpUrl: string;
  keyHelpLabel: string;
  defaultModel: string;
}

export const PROVIDERS: Record<Provider, ProviderConfig> = {
  anthropic: {
    label: 'Claude (Anthropic)',
    keyPlaceholder: 'sk-ant-...',
    keyHelpUrl: 'https://console.anthropic.com',
    keyHelpLabel: 'console.anthropic.com',
    defaultModel: 'claude-3-5-haiku-20241022',
  },
  google: {
    label: 'Gemini (Google)',
    keyPlaceholder: 'AIza...',
    keyHelpUrl: 'https://aistudio.google.com/app/apikey',
    keyHelpLabel: 'aistudio.google.com',
    defaultModel: 'gemini-2.0-flash',
  },
  openai: {
    label: 'ChatGPT (OpenAI)',
    keyPlaceholder: 'sk-...',
    keyHelpUrl: 'https://platform.openai.com/api-keys',
    keyHelpLabel: 'platform.openai.com',
    defaultModel: 'gpt-4o-mini',
  },
};

export interface Summaries {
  twitter: string;
  thread: string;
  linkedin: string;
  geekNews: string;
}

export interface SummarizeResult {
  summaries: Summaries;
  error?: never;
}

export interface SummarizeError {
  summaries?: never;
  error: string;
}

export type SummarizeResponse = SummarizeResult | SummarizeError;

export const PLATFORM_LIMITS = {
  twitter: 250,
  thread: 500,
  linkedin: 800,
  geekNews: 1000,
} as const;

export const PLATFORM_LABELS: Record<keyof Summaries, string> = {
  twitter: '🐦 Twitter',
  thread: '🧵 Thread',
  linkedin: '💼 LinkedIn',
  geekNews: '🤓 Geek News',
};
```

- [ ] **Step 4: 커밋**

```bash
git init
git add .
git commit -m "feat: project scaffolding with Next.js 15 and AI SDK"
```

---

## Task 2: Content Extraction

**Files:**
- Create: `lib/extract-content.ts`

- [ ] **Step 1: 콘텐츠 추출 함수 작성**

`lib/extract-content.ts` 생성:

```typescript
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

export interface ExtractResult {
  title: string;
  content: string;
}

export async function extractContent(url: string): Promise<ExtractResult> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SocialSummaryBot/1.0)',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`페이지를 불러올 수 없습니다 (HTTP ${response.status})`);
  }

  const html = await response.text();
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article || !article.textContent?.trim()) {
    throw new Error(
      '페이지에서 읽을 수 있는 내용을 찾지 못했습니다. JS 렌더링이 필요한 페이지일 수 있습니다.'
    );
  }

  return {
    title: article.title ?? '',
    content: article.textContent.trim().slice(0, 8000),
  };
}
```

- [ ] **Step 2: 커밋**

```bash
git add lib/extract-content.ts lib/types.ts
git commit -m "feat: HTML content extraction with Readability"
```

---

## Task 3: Server Action (URL Fetch + AI Summarize)

**Files:**
- Create: `app/actions/summarize.ts`

- [ ] **Step 1: Server Action 작성**

`app/actions/summarize.ts` 생성:

```typescript
'use server';

import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { extractContent } from '@/lib/extract-content';
import {
  Provider,
  PROVIDERS,
  Summaries,
  SummarizeResponse,
  PLATFORM_LIMITS,
} from '@/lib/types';

function createModel(provider: Provider, apiKey: string) {
  switch (provider) {
    case 'anthropic':
      return createAnthropic({ apiKey })(PROVIDERS.anthropic.defaultModel);
    case 'google':
      return createGoogleGenerativeAI({ apiKey })(PROVIDERS.google.defaultModel);
    case 'openai':
      return createOpenAI({ apiKey })(PROVIDERS.openai.defaultModel);
  }
}

const SUMMARY_PROMPT = (title: string, content: string) => `
다음 글을 4개 플랫폼에 맞게 요약해줘. 각 요약은 한국어로 작성하고 글자 수 제한을 반드시 지켜야 해.

제목: ${title}

본문:
${content}

각 플랫폼 요약 요건:
- twitter: 최대 ${PLATFORM_LIMITS.twitter}자. 핵심만 담은 간결하고 임팩트 있는 문장.
- thread: 최대 ${PLATFORM_LIMITS.thread}자. 조금 더 상세하게, 대화체로.
- linkedin: 최대 ${PLATFORM_LIMITS.linkedin}자. 전문적인 톤, 인사이트 강조.
- geekNews: 최대 ${PLATFORM_LIMITS.geekNews}자. IT 커뮤니티 대상, 기술적 관점 강조, 핵심 기술/수치 포함.

반드시 아래 JSON 형식으로만 응답해 (다른 텍스트 없이):
{
  "twitter": "...",
  "thread": "...",
  "linkedin": "...",
  "geekNews": "..."
}
`.trim();

export async function summarizeUrl(
  url: string,
  provider: Provider,
  apiKey: string
): Promise<SummarizeResponse> {
  try {
    const { title, content } = await extractContent(url);
    const model = createModel(provider, apiKey);

    const { text } = await generateText({
      model,
      prompt: SUMMARY_PROMPT(title, content),
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI 응답을 파싱할 수 없습니다. 다시 시도해주세요.');
    }

    const summaries = JSON.parse(jsonMatch[0]) as Summaries;

    // 글자 수 초과 시 잘라내기 (안전장치)
    const keys = Object.keys(PLATFORM_LIMITS) as Array<keyof typeof PLATFORM_LIMITS>;
    for (const key of keys) {
      if (summaries[key].length > PLATFORM_LIMITS[key]) {
        summaries[key] = summaries[key].slice(0, PLATFORM_LIMITS[key]);
      }
    }

    return { summaries };
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
    return { error: message };
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add app/actions/summarize.ts
git commit -m "feat: server action for URL fetch and AI summarization"
```

---

## Task 4: ApiKeyInput Component

**Files:**
- Create: `components/ApiKeyInput.tsx`

- [ ] **Step 1: ApiKeyInput 컴포넌트 작성**

`components/ApiKeyInput.tsx` 생성:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Provider, PROVIDERS } from '@/lib/types';

interface ApiKeyInputProps {
  provider: Provider;
  apiKey: string;
  onProviderChange: (provider: Provider) => void;
  onApiKeyChange: (key: string) => void;
}

export function ApiKeyInput({
  provider,
  apiKey,
  onProviderChange,
  onApiKeyChange,
}: ApiKeyInputProps) {
  const [visible, setVisible] = useState(false);
  const config = PROVIDERS[provider];

  return (
    <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          AI 제공자
        </label>
        <select
          value={provider}
          onChange={(e) => onProviderChange(e.target.value as Provider)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {(Object.keys(PROVIDERS) as Provider[]).map((p) => (
            <option key={p} value={p}>
              {PROVIDERS[p].label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          🔑 API Key
        </label>
        <div className="relative">
          <input
            type={visible ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder={config.keyPlaceholder}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
          >
            {visible ? '🙈' : '👁️'}
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          💡 API 키는{' '}
          <a
            href={config.keyHelpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 underline"
          >
            {config.keyHelpLabel}
          </a>
          에서 확인할 수 있습니다
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add components/ApiKeyInput.tsx
git commit -m "feat: ApiKeyInput component with provider selection"
```

---

## Task 5: SummaryCard Component

**Files:**
- Create: `components/SummaryCard.tsx`

- [ ] **Step 1: SummaryCard 컴포넌트 작성**

`components/SummaryCard.tsx` 생성:

```tsx
'use client';

import { useState } from 'react';
import { PLATFORM_LIMITS, PLATFORM_LABELS, Summaries } from '@/lib/types';

interface SummaryCardProps {
  platform: keyof Summaries;
  text: string;
}

export function SummaryCard({ platform, text }: SummaryCardProps) {
  const [copied, setCopied] = useState(false);
  const limit = PLATFORM_LIMITS[platform];
  const label = PLATFORM_LABELS[platform];
  const count = text.length;
  const ratio = count / limit;

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">{label}</h3>
        <button
          onClick={handleCopy}
          className="text-xs px-3 py-1 rounded-full border border-indigo-300 text-indigo-600 hover:bg-indigo-50 transition-colors"
        >
          {copied ? '✅ 복사됨!' : '📋 복사'}
        </button>
      </div>

      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{text}</p>

      <div className="space-y-1">
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              ratio > 0.9 ? 'bg-red-400' : ratio > 0.7 ? 'bg-yellow-400' : 'bg-indigo-400'
            }`}
            style={{ width: `${Math.min(ratio * 100, 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 text-right">
          {count} / {limit}자
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add components/SummaryCard.tsx
git commit -m "feat: SummaryCard with char count progress bar and copy button"
```

---

## Task 6: Main Page (app/page.tsx)

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: layout.tsx 업데이트**

`app/layout.tsx` 교체:

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Social Summary',
  description: 'URL을 입력하면 SNS 플랫폼별 요약문을 자동 생성합니다',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: 메인 page.tsx 작성**

`app/page.tsx` 교체:

```tsx
'use client';

import { useState, useEffect, useTransition } from 'react';
import { ApiKeyInput } from '@/components/ApiKeyInput';
import { SummaryCard } from '@/components/SummaryCard';
import { summarizeUrl } from '@/app/actions/summarize';
import { Provider, Summaries } from '@/lib/types';

const LS_PROVIDER = 'ss_provider';
const LS_API_KEY = 'ss_api_key';
const LS_HISTORY = 'ss_history';

export default function Home() {
  const [provider, setProvider] = useState<Provider>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [url, setUrl] = useState('');
  const [summaries, setSummaries] = useState<Summaries | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  // localStorage 불러오기
  useEffect(() => {
    const savedProvider = localStorage.getItem(LS_PROVIDER) as Provider | null;
    const savedKey = localStorage.getItem(LS_API_KEY);
    const savedHistory = localStorage.getItem(LS_HISTORY);
    if (savedProvider) setProvider(savedProvider);
    if (savedKey) setApiKey(savedKey);
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, []);

  function handleProviderChange(p: Provider) {
    setProvider(p);
    localStorage.setItem(LS_PROVIDER, p);
  }

  function handleApiKeyChange(key: string) {
    setApiKey(key);
    localStorage.setItem(LS_API_KEY, key);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey || !url) return;

    setError(null);
    setSummaries(null);

    startTransition(async () => {
      const result = await summarizeUrl(url, provider, apiKey);

      if (result.error) {
        setError(result.error);
        return;
      }

      setSummaries(result.summaries);

      // 히스토리 저장 (최근 10개)
      const next = [url, ...history.filter((h) => h !== url)].slice(0, 10);
      setHistory(next);
      localStorage.setItem(LS_HISTORY, JSON.stringify(next));
    });
  }

  const canSubmit = !!apiKey && !!url && !isPending;

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-3xl font-bold text-gray-900">Social Summary</h1>
        <p className="text-gray-500 text-sm">URL을 입력하면 SNS 플랫폼별 요약문을 생성해드립니다</p>
      </div>

      <ApiKeyInput
        provider={provider}
        apiKey={apiKey}
        onProviderChange={handleProviderChange}
        onApiKeyChange={handleApiKeyChange}
      />

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">🌐 URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {history.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {history.slice(0, 5).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setUrl(h)}
                className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 truncate max-w-[200px]"
              >
                {h}
              </button>
            ))}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? '요약 생성 중...' : '요약 생성'}
        </button>
      </form>

      {isPending && (
        <div className="text-center py-8 text-gray-500 text-sm animate-pulse">
          페이지를 읽고 요약 중입니다...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {summaries && (
        <div className="space-y-4">
          {(['twitter', 'thread', 'linkedin', 'geekNews'] as const).map((platform) => (
            <SummaryCard key={platform} platform={platform} text={summaries[platform]} />
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 3: 개발 서버 실행 및 동작 확인**

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속 → API 키 입력 → URL 입력 → 요약 생성 확인

- [ ] **Step 4: 커밋**

```bash
git add app/page.tsx app/layout.tsx
git commit -m "feat: main page with full UI and localStorage persistence"
```

---

## Task 7: Build Verification & Final Polish

**Files:**
- Modify: `next.config.ts` (필요시)

- [ ] **Step 1: 프로덕션 빌드 확인**

```bash
npm run build
```

Expected: 에러 없이 빌드 완료. 타입 에러나 ESLint 에러 확인.

- [ ] **Step 2: jsdom 서버 환경 설정 확인**

`next.config.ts` 에 serverExternalPackages 추가 (jsdom이 서버에서만 동작하도록):

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@mozilla/readability', 'jsdom'],
};

export default nextConfig;
```

- [ ] **Step 3: 빌드 재확인**

```bash
npm run build
```

Expected: 빌드 성공

- [ ] **Step 4: .gitignore 확인**

`.gitignore` 에 아래 항목 포함 확인:
```
.superpowers/
.env*.local
```

- [ ] **Step 5: 최종 커밋**

```bash
git add next.config.ts .gitignore
git commit -m "feat: production build config and final polish"
```
