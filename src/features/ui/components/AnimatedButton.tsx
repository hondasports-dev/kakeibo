import { motion } from "framer-motion";
import { Button, CircularProgress } from "@mui/material";
import type { ButtonProps } from "@mui/material";

/**
 * AnimatedButton コンポーネントのプロパティ
 */
interface AnimatedButtonProps extends ButtonProps {
  /** ローディング状態を表示するかどうか */
  loading?: boolean;
}

/** タップ・ホバー時のアニメーションバリアント */
const buttonVariants = {
  tap: { scale: 0.98 },
  hover: { scale: 1.02 },
};

/**
 * タップ・ホバー時にスケールアニメーションを適用するボタンコンポーネント
 *
 * @example
 * ```tsx
 * <AnimatedButton loading={isSaving} onClick={handleSave}>
 *   保存
 * </AnimatedButton>
 * ```
 */
export function AnimatedButton({
  children,
  loading = false,
  disabled,
  fullWidth = false,
  ...buttonProps
}: AnimatedButtonProps) {
  return (
    <motion.div
      whileTap={!disabled && !loading ? "tap" : undefined}
      whileHover={!disabled && !loading ? "hover" : undefined}
      variants={buttonVariants}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      style={{ width: fullWidth ? "100%" : "auto" }}
    >
      <Button
        {...buttonProps}
        disabled={disabled || loading}
        fullWidth={fullWidth}
        aria-busy={loading}
      >
        {loading ? (
          <>
            <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />
            {children}
          </>
        ) : (
          children
        )}
      </Button>
    </motion.div>
  );
}
