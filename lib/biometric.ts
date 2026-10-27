import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type BiometricPreference = 'on' | 'off' | 'unset';

function preferenceKey(userId: string) {
  return `gate8.auth.biometric.${userId}`;
}

export async function biometricsAvailable() {
  if (Platform.OS === 'web') return false;
  try {
    const [hardware, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hardware && enrolled;
  } catch {
    return false;
  }
}

export async function confirmDeviceOwner() {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Desbloquear o Gate8',
      cancelLabel: 'Cancelar',
      fallbackLabel: 'Usar senha do celular',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}

export async function readBiometricPreference(userId: string): Promise<BiometricPreference> {
  try {
    const value = await SecureStore.getItemAsync(preferenceKey(userId));
    if (value === 'on' || value === 'off') return value;
    return 'unset';
  } catch {
    return 'unset';
  }
}

export async function writeBiometricPreference(userId: string, preference: 'on' | 'off') {
  await SecureStore.setItemAsync(preferenceKey(userId), preference);
}
