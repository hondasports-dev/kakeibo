import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { CollapsibleHelp } from "../../ui";
import {
  useReceiptImageExtraction,
  type ExtractedReceiptResult,
} from "../hooks/useReceiptImageExtraction";
import { ReceiptImagePreview } from "./ReceiptImagePreview";
import { ReceiptImageExtractorConsentDialog } from "./ReceiptImageExtractorConsentDialog";

export type {
  ExtractedReceiptFields,
  ExtractedReceiptResult,
} from "../hooks/useReceiptImageExtraction";

interface ReceiptImageExtractorProps {
  /** 抽出成功時に呼ばれるコールバック */
  onExtracted: (result: ExtractedReceiptResult) => void;
}

export function ReceiptImageExtractor({ onExtracted }: ReceiptImageExtractorProps) {
  const {
    clearSelectedImage,
    consentDialogOpen,
    consentIsLoading,
    consentStatus,
    errorMessage,
    handleAcceptAndExtract,
    handleCloseConsentDialog,
    handleDeclineConsent,
    handleExtract,
    handleImageChange,
    imageInputRef,
    noticeMessages,
    parseStatus,
    previewCanvasRef,
    selectedFile,
    setNoticeMessages,
  } = useReceiptImageExtraction({ onExtracted });

  return (
    <Box
      aria-labelledby="receipt-image-upload-heading"
      className="receipt-image-upload"
      component="section"
    >
      <Stack spacing={1.5}>
        <Box>
          <Typography
            component="h3"
            id="receipt-image-upload-heading"
            variant="subtitle1"
            sx={{ fontWeight: 700 }}
          >
            画像から入力
          </Typography>
          <CollapsibleHelp summary="画像読み取りについて">
            <Typography color="text.secondary" variant="body2">
              画像は保存されません。確認用の一時プレビューです。
            </Typography>
            <Typography color="text.secondary" variant="body2">
              読み取り時はレシート画像を外部APIへ送信します。抽出結果は自動保存されません。
            </Typography>
          </CollapsibleHelp>
        </Box>

        {errorMessage && (
          <Alert
            severity="error"
            variant="outlined"
            action={
              <Button color="error" onClick={() => clearSelectedImage()} size="small" type="button">
                クリア
              </Button>
            }
          >
            {errorMessage}
            {parseStatus === "error" && (
              <Typography component="span" variant="body2" sx={{ display: "block", mt: 0.5 }}>
                手入力でも保存できます。
              </Typography>
            )}
          </Alert>
        )}

        {noticeMessages.length > 0 && (
          <Alert
            severity="warning"
            variant="outlined"
            action={
              <Button
                color="warning"
                onClick={() => setNoticeMessages([])}
                size="small"
                type="button"
              >
                閉じる
              </Button>
            }
          >
            <Stack spacing={0.5}>
              {noticeMessages.map((message) => (
                <Typography component="span" key={message} variant="body2">
                  {message}
                </Typography>
              ))}
            </Stack>
          </Alert>
        )}

        {selectedFile ? (
          <ReceiptImagePreview
            disabled={parseStatus === "parsing"}
            fileName={selectedFile.name}
            onClear={() => clearSelectedImage()}
            previewCanvasRef={previewCanvasRef}
          />
        ) : (
          <Typography color="text.secondary" variant="body2">
            レシート画像を選ぶと、ここにプレビューを表示します。
          </Typography>
        )}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button onClick={() => imageInputRef.current?.click()} type="button" variant="outlined">
            画像を選択
            <input
              accept="image/*"
              aria-label="レシート画像を選択"
              className="visually-hidden-file-input"
              onChange={handleImageChange}
              ref={imageInputRef}
              tabIndex={-1}
              type="file"
            />
          </Button>
          <Button
            disabled={!selectedFile || parseStatus === "parsing" || consentIsLoading}
            onClick={() => void handleExtract()}
            startIcon={parseStatus === "parsing" ? <CircularProgress size={16} /> : undefined}
            type="button"
            variant="outlined"
          >
            {parseStatus === "parsing" ? "解析中..." : "読み取る"}
          </Button>
        </Stack>
      </Stack>

      <ReceiptImageExtractorConsentDialog
        onAccept={() => void handleAcceptAndExtract()}
        onClose={handleCloseConsentDialog}
        onDecline={handleDeclineConsent}
        open={consentDialogOpen}
        saving={consentStatus === "saving"}
      />
    </Box>
  );
}
