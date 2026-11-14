import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'br.com.barberhub.app',
  appName: 'BarberHUB',
  webDir: 'dist',
  backgroundColor: '#09090b',
  android: { allowMixedContent: false },
  ios: { contentInset: 'never' },
}

export default config
