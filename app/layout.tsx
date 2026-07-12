import type { Metadata } from 'next';
import { Playfair_Display, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

const playfair = Playfair_Display({ subsets: ['latin'], weight: ['400', '700', '900'], variable: '--font-serif' });
const ibmPlex = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-sans' });

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
      <body className={`${playfair.variable} ${ibmPlex.variable} font-[family-name:var(--font-sans)] min-h-screen`} style={{ background: '#f5f0e8' }}>{children}</body>
    </html>
  );
}
