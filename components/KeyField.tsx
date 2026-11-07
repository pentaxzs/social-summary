'use client';

import { useState } from 'react';

/** 보조 키 입력. 저장 여부가 보이지 않아 넣었는지 아닌지 알 수 없던 문제를 막는다 */
export function KeyField({
  label, value, onChange, hint,
}: { label: string; value: string; onChange: (v: string) => void; hint: string }) {
  const [show, setShow] = useState(false);
  const saved = value.length > 0;
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: saved ? '#2d6a44' : '#a8541c' }}
        />
        <span className="np-label np-label-latin">{label}</span>
        <span className="text-[11px] text-[var(--soft)] normal-case tracking-normal">
          {saved ? '저장됨' : '비어 있음'}
        </span>
        {saved && (
          <button type="button" onClick={() => setShow((v) => !v)}
            className="ml-auto text-[11px] underline underline-offset-2 text-[var(--soft)]">
            {show ? '가리기' : '보기'}
          </button>
        )}
      </div>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        className="w-full border border-[var(--hair)] px-3 py-2 text-base bg-[var(--paper)] placeholder:text-[var(--faint)] focus:outline-none focus:border-[var(--ink)]"
      />
      <p className="mt-1 text-[11px] text-[var(--soft)]">{hint}</p>
    </div>
  );
}
