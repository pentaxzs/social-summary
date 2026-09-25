'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * 서버 렌더에서는 false, 클라이언트 하이드레이션 이후 true.
 *
 * localStorage 처럼 브라우저에만 있는 값에 따라 UI를 바꿀 때, 서버와
 * 클라이언트가 같은 첫 렌더를 그리도록 만들어 하이드레이션 불일치를 막는다.
 * effect 안에서 setState 하는 방식과 달리 추가 렌더를 유발하지 않는다.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
