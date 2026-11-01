import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans } from 'next/font/google';
import { euljiro, hanna, pretendardBold, pretendardMedium } from '@/lib/fonts';
import './globals.css';

const ibmPlex = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-sans' });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // 확대를 막지 않는다. iOS 가 입력 포커스에서 자동 확대하는 건 폰트가 16px
  // 미만일 때뿐이고, 이 앱의 입력은 전부 16px 이상이라 이미 해결돼 있다.
  // 잠가두면 글씨가 작다고 느낀 사람이 손가락으로 키울 방법이 사라진다.
};

export const metadata: Metadata = {
  title: 'Social Summary',
  description: 'URL을 입력하면 SNS 플랫폼별 요약문을 자동 생성합니다',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${ibmPlex.variable} ${euljiro.variable} ${hanna.variable} ${pretendardBold.variable} ${pretendardMedium.variable} font-[family-name:var(--font-sans)] min-h-screen bg-[var(--paper)]`}>{children}</body>
    </html>
  );
}
