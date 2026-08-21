import { registerWebModule, NativeModule } from 'expo';

import { SwipelyMediaDeleteModuleEvents } from './SwipelyMediaDelete.types';

class SwipelyMediaDeleteModule extends NativeModule<SwipelyMediaDeleteModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
}

export default registerWebModule(SwipelyMediaDeleteModule, 'SwipelyMediaDeleteModule');
