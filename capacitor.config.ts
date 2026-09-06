import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aiwealthos.app',
  appName: 'AI Wealth OS',

  server: {
    url: 'https://ai-wealth-os-gamma.vercel.app',
    cleartext: false
  }
};

export default config;