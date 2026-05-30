import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}

export function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
  duration = 0.5,
}: AnimatedCounterProps) {
  const spring = useSpring(0, {
    mass: 1,
    stiffness: 75,
    damping: 15,
    duration: duration * 1000,
  });

  const display = useTransform(spring, (current) =>
    Math.round(current).toLocaleString("ja-JP"),
  );

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return (
    <span aria-live="polite" aria-atomic="true">
      {prefix}
      <motion.span>{display}</motion.span>
      {suffix}
    </span>
  );
}
