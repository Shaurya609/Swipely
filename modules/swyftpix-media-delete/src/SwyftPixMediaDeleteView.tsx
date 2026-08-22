import { requireNativeView } from 'expo';
import * as React from 'react';

import { SwipelyMediaDeleteViewProps } from './SwipelyMediaDelete.types';

const NativeView: React.ComponentType<SwipelyMediaDeleteViewProps> =
  requireNativeView('SwipelyMediaDelete');

export default function SwipelyMediaDeleteView(props: SwipelyMediaDeleteViewProps) {
  return <NativeView {...props} />;
}
