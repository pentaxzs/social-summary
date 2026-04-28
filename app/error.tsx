'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[App Error]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-red-200 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-bold text-red-700">⚠️ 오류가 발생했습니다</h2>
        <p className="text-sm text-gray-600 break-all">
          {error.message || '알 수 없는 오류'}
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400">digest: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
