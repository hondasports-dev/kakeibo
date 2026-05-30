import { motion, type Transition } from "framer-motion";
import type { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

const pageVariants = {
  initial: {
    opacity: 0,
    x: -20,
  },
  animate: {
    opacity: 1,
    x: 0,
  },
  exit: {
    opacity: 0,
    x: 20,
  },
};

const pageTransition: Transition = {
  type: "tween",
  ease: [0.25, 0.1, 0.25, 1.0],
  duration: 0.3,
};

export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <motion.div
      aria-label="ページコンテンツ"
      aria-live="polite"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
      transition={pageTransition}
      className={className}
    >
      {children}
    </motion.div>
  );
}
