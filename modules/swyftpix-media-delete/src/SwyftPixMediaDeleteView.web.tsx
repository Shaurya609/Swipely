import * as React from 'react';

import { SwyftPixMediaDeleteViewProps } from './SwyftPixMediaDelete.types';

export default function SwyftPixMediaDeleteView(props: SwyftPixMediaDeleteViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
