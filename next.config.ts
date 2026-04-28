import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@mozilla/readability',
    'jsdom',
    'ai',
    '@ai-sdk/anthropic',
    '@ai-sdk/google',
    '@ai-sdk/openai',
  ],
};

export default nextConfig;
