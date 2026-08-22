import { registerWebModule, NativeModule } from 'expo';

import { SwyftPixMediaDeleteModuleEvents } from './SwyftPixMediaDelete.types';

class SwyftPixMediaDeleteModule extends NativeModule<SwyftPixMediaDeleteModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
}

export default registerWebModule(SwyftPixMediaDeleteModule, 'SwyftPixMediaDeleteModule');
