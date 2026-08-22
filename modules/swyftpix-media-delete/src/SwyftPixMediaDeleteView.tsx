import { requireNativeView } from 'expo';
import * as React from 'react';

import { SwyftPixMediaDeleteViewProps } from './SwyftPixMediaDelete.types';

const NativeView: React.ComponentType<SwyftPixMediaDeleteViewProps> =
  requireNativeView('SwyftPixMediaDelete');

export default function SwyftPixMediaDeleteView(props: SwyftPixMediaDeleteViewProps) {
  return <NativeView {...props} />;
}
