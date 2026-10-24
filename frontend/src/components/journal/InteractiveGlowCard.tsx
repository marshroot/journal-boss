import React, { useRef } from 'react';
import { motion, HTMLMotionProps } from 'motion/react';

interface InteractiveGlowCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children?: React.ReactNode;
  glowColor?: string; // Optional custom glow color (e.g. rgba(0, 255, 194, 0.15))
  contentClassName?: string;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

export default function InteractiveGlowCard({
  children,
  className = '',
  style = {},
  glowColor,
  contentClassName = '',
  containerRef,
  ...props
}: InteractiveGlowCardProps) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const cardRef = containerRef || localRef;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    cardRef.current.style.setProperty('--mouse-x', `${x}px`);
    cardRef.current.style.setProperty('--mouse-y', `${y}px`);
  };

  const cardStyle: any = {
    ...style,
    position: 'relative',
    overflow: 'hidden',
  };

  if (glowColor) {
    cardStyle['--card-glow-color' as any] = glowColor;
  }

  return (
    <motion.div
      ref={cardRef}
      className={`glow-card ${className}`}
      style={cardStyle}
      onMouseMove={handleMouseMove}
      {...props}
    >
      {/* Dynamic background glow layer */}
      <div className="glow-card-bg-layer" />
      {/* Content wrapper */}
      <div className={`glow-card-content ${contentClassName}`}>
        {children}
      </div>
    </motion.div>
  );
}
