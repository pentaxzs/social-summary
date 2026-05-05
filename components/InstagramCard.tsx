'use client';

import { useState } from 'react';
import { InstagramPost, InstagramSlide } from '@/lib/types';

interface InstagramCardProps {
  post: InstagramPost;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  // 공백 기준으로 분리, 한국어는 글자 단위 fallback
  const words = text.split(' ');
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawSlide(
  slide: InstagramSlide,
  index: number,
  total: number
): HTMLCanvasElement {
  const SIZE = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  // 배경
  ctx.fillStyle = slide.background_color || '#1e3a5f';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // 그라디언트 오버레이 (깊이감)
  const grad = ctx.createLinearGradient(0, 0, 0, SIZE);
  grad.addColorStop(0, 'rgba(0,0,0,0.05)');
  grad.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // 슬라이드 번호 (우상단)
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '38px system-ui, -apple-system, "Apple SD Gothic Neo", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${index + 1} / ${total}`, SIZE - 64, 80);

  // 헤드라인
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 86px system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
  ctx.textAlign = 'center';

  const headLines = wrapText(ctx, slide.headline, SIZE - 180);
  const lineH = 108;
  const headH = headLines.length * lineH;
  const hasBody = !!(slide.body && slide.body.trim());

  // 전체 블록 수직 중앙 정렬
  const bodyH = hasBody ? 80 : 0;
  const gap = hasBody ? 52 : 0;
  const totalH = headH + gap + bodyH;
  let y = (SIZE - totalH) / 2 + lineH * 0.8;

  headLines.forEach((line, i) => {
    ctx.fillText(line, SIZE / 2, y + i * lineH);
  });

  // 본문 (선택)
  if (hasBody) {
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.font = `50px system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
    ctx.textAlign = 'center';
    const bodyLines = wrapText(ctx, slide.body!, SIZE - 200);
    const bodyY = y + headH - lineH * 0.8 + gap + 50;
    bodyLines.slice(0, 2).forEach((line, i) => {
      ctx.fillText(line, SIZE / 2, bodyY + i * 68);
    });
  }

  // 하단 인디케이터 점
  const dotR = 10;
  const dotGap = 30;
  const dotsW = total * dotR * 2 + (total - 1) * (dotGap - dotR * 2);
  let dotX = (SIZE - dotsW) / 2 + dotR;
  const dotY = SIZE - 64;

  for (let i = 0; i < total; i++) {
    ctx.beginPath();
    ctx.arc(dotX, dotY, i === index ? 14 : dotR, 0, Math.PI * 2);
    ctx.fillStyle = i === index ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.35)';
    ctx.fill();
    dotX += dotGap;
  }

  return canvas;
}

function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

export function InstagramCard({ post }: InstagramCardProps) {
  const [current, setCurrent] = useState(0);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const slide = post.slides[current];
  const total = post.slides.length;

  function handleDownloadCurrent() {
    const canvas = drawSlide(slide, current, total);
    downloadCanvas(canvas, `instagram-slide-${current + 1}.png`);
  }

  function handleDownloadAll() {
    post.slides.forEach((s, i) => {
      setTimeout(() => {
        const canvas = drawSlide(s, i, total);
        downloadCanvas(canvas, `instagram-slide-${i + 1}.png`);
      }, i * 400);
    });
  }

  async function handleCopyCaption() {
    await navigator.clipboard.writeText(post.caption);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  }

  return (
    <div className="rounded-2xl border bg-gradient-to-br from-fuchsia-50 to-white border-fuchsia-200 shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-fuchsia-200">
        <span className="text-sm sm:text-base font-bold px-3 py-1 rounded-full bg-fuchsia-100 text-fuchsia-700">
          📸 Instagram
        </span>
        <button
          onClick={handleDownloadAll}
          className="flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white border border-gray-200 text-gray-600 hover:border-fuchsia-300 hover:text-fuchsia-600 active:scale-95 transition-all shadow-sm"
        >
          ⬇️ 전체 다운로드
        </button>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* 슬라이드 미리보기 (정방형) */}
        <div
          className="relative w-full aspect-square rounded-xl overflow-hidden flex flex-col items-center justify-center p-8 select-none"
          style={{ backgroundColor: slide.background_color || '#1e3a5f' }}
        >
          {/* 그라디언트 오버레이 */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-black/35 pointer-events-none" />

          {/* 슬라이드 번호 */}
          <div className="absolute top-4 right-4 text-white/55 text-xs sm:text-sm font-medium">
            {current + 1} / {total}
          </div>

          {/* 텍스트 */}
          <div className="relative z-10 text-center space-y-3 px-2">
            <p className="text-white font-bold text-xl sm:text-3xl leading-snug drop-shadow-sm">
              {slide.headline}
            </p>
            {slide.body && slide.body.trim() && (
              <p className="text-white/80 text-sm sm:text-base leading-relaxed">
                {slide.body}
              </p>
            )}
          </div>

          {/* 하단 인디케이터 */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
            {post.slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`rounded-full transition-all ${
                  i === current
                    ? 'w-4 h-2.5 bg-white/95'
                    : 'w-2.5 h-2.5 bg-white/35 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        </div>

        {/* 네비게이션 */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrent(Math.max(0, current - 1))}
            disabled={current === 0}
            className="px-4 py-2 rounded-full bg-gray-100 text-gray-600 text-sm disabled:opacity-30 hover:bg-fuchsia-50 hover:text-fuchsia-600 transition-all"
          >
            ← 이전
          </button>
          <span className="text-xs text-gray-400 tabular-nums">
            {current + 1} / {total}장
          </span>
          <button
            onClick={() => setCurrent(Math.min(total - 1, current + 1))}
            disabled={current === total - 1}
            className="px-4 py-2 rounded-full bg-gray-100 text-gray-600 text-sm disabled:opacity-30 hover:bg-fuchsia-50 hover:text-fuchsia-600 transition-all"
          >
            다음 →
          </button>
        </div>

        {/* 현재 슬라이드 다운로드 */}
        <button
          onClick={handleDownloadCurrent}
          className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-fuchsia-300 hover:text-fuchsia-600 hover:bg-fuchsia-50 transition-all"
        >
          📥 현재 슬라이드 PNG 저장 (1080×1080)
        </button>
      </div>

      {/* 본문 캡션 */}
      <div className="px-4 sm:px-5 pb-5 pt-1 space-y-2 border-t border-fuchsia-100">
        <div className="flex items-center justify-between pt-3">
          <span className="text-sm font-semibold text-gray-700">본문 캡션</span>
          <button
            onClick={handleCopyCaption}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-600 hover:border-fuchsia-300 hover:text-fuchsia-600 active:scale-95 transition-all shadow-sm"
          >
            {copiedCaption ? '✅ 복사됨!' : '📋 복사'}
          </button>
        </div>
        <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-xl p-3">
          {post.caption}
        </p>
        <p className="text-xs text-gray-400 text-right tabular-nums">
          {post.caption.length}자
        </p>
      </div>
    </div>
  );
}
