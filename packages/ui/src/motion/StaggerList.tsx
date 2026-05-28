import React from 'react';
import { View, type ViewProps } from 'react-native';

import { FadeInOnScroll } from './FadeInOnScroll.js';

export type StaggerListProps = ViewProps & {
  /** Delay between sibling animations in ms. */
  stagger?: number;
  children: React.ReactNode;
};

/**
 * Wraps every direct child in a `<FadeInOnScroll>` with a staggered delay.
 * Single mount = animation runs once. Use the wrapper key prop to retrigger.
 */
export function StaggerList({ stagger = 60, children, style, ...rest }: StaggerListProps) {
  const items = React.Children.toArray(children);
  return (
    <View style={style} {...rest}>
      {items.map((child, i) => (
        <FadeInOnScroll key={i} delay={i * stagger}>
          {child}
        </FadeInOnScroll>
      ))}
    </View>
  );
}
