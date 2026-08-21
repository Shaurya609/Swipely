import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

type NativeMediaDeleteModule = {
  deleteMediaByPath(path: string): Promise<boolean>;
};

const NativeMediaDelete = Platform.OS === 'android'
  ? requireNativeModule<NativeMediaDeleteModule>('SwipelyMediaDelete')
  : null;

export async function deleteMediaByPath(path: string): Promise<boolean> {
  if (!NativeMediaDelete) return false;
  return NativeMediaDelete.deleteMediaByPath(path);
}
