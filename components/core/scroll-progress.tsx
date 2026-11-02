'use client';

import { motion, useScroll, useSpring, SpringOptions } from 'framer-motion';
import React, { RefObject } from 'react';

export interface ScrollProgressProps {
  className?: string;
  style?: React.CSSProperties;
  containerRef?: RefObject<HTMLElement>;
  springOptions?: SpringOptions;
}

export function ScrollProgress({
  className = '',
  style,
  containerRef,
  springOptions,
}: ScrollProgressProps) {
  const { scrollYProgress } = useScroll({
    container: containerRef,
  });

  const scaleX = useSpring(scrollYProgress, springOptions ?? {
    stiffness: 280,
    damping: 18,
    mass: 0.3,
  });

  return (
    <motion.div
      className={className}
      style={{
        scaleX,
        transformOrigin: 'left',
        ...style,
      }}
    />
  );
}
