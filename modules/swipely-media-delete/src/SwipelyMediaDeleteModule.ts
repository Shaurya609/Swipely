import { NativeModule, requireNativeModule } from 'expo';

import { SwipelyMediaDeleteModuleEvents } from './SwipelyMediaDelete.types';

declare class SwipelyMediaDeleteModule extends NativeModule<SwipelyMediaDeleteModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<SwipelyMediaDeleteModule>('SwipelyMediaDelete');
