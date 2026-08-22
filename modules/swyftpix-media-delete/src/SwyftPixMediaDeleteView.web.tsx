import * as React from 'react';

import { SwipelyMediaDeleteViewProps } from './SwipelyMediaDelete.types';

export default function SwipelyMediaDeleteView(props: SwipelyMediaDeleteViewProps) {
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
