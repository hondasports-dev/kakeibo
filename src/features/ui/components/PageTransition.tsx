import { motion, type Transition, type Variants } from "framer-motion";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import type { ReactNode } from "react";

/**
 * PageTransition コンポーネントのプロパティ
 */
interface PageTransitionProps {
  /** 子要素 */
  children: ReactNode;
  /** カスタムクラス名 */
  className?: string;
}

/** ページ遷移時のトランジション設定 */
const pageTransition: Transition = {
  type: "tween",
  ease: [0.25, 0.1, 0.25, 1.0],
  duration: 0.3,
};

function getPageVariants(reduceMotion: boolean): Variants {
  if (reduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    };
  }

  return {
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
}

/**
 * ページ遷移時にスライド・フェードアニメーションを適用するコンポーネント
 *
 * @example
 * ```tsx
 * <PageTransition>
 *   <DashboardPage />
 * </PageTransition>
 * ```
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const pageVariants = getPageVariants(isMobile);

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
      style={{ maxWidth: "100%", minWidth: 0, overflowX: "hidden" }}
    >
      {children}
    </motion.div>
  );
}
