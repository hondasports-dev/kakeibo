import { useRef, useState, type ChangeEvent } from "react";
import { useAction, useMutation } from "convex/react";
import type { Doc } from "../../../../convex/_generated/dataModel";
import { api } from "../../../../convex/_generated/api";
import { getImageFileErrorMessage, resizeImageFileToDataUrl } from "../../../utils/imageDataUrl";

export function useRetry({
  pendingImageDataUrls,
  setPendingImageDataUrls,
}: {
  pendingImageDataUrls: Map<string, string>;
  setPendingImageDataUrls: React.Dispatch<React.SetStateAction<Map<string, string>>>;
}) {
  const retryInputRef = useRef<HTMLInputElement>(null);
  const [retryError, setRetryError] = useState("");
  const [pendingRetryJob, setPendingRetryJob] = useState<Doc<"receiptAnalysisImageJobs"> | null>(
    null,
  );

  const retryImageJob = useMutation(api.receiptAnalysisJobs.retryImageJob);
  const analyzeImageJob = useAction(api.receiptAnalysisJobs.analyzeImageJob);

  const runRetry = async (job: Doc<"receiptAnalysisImageJobs">, imageDataUrl: string) => {
    setRetryError("");
    setPendingImageDataUrls((current) => {
      const next = new Map(current);
      next.set(job._id, imageDataUrl);
      return next;
    });
    try {
      await retryImageJob({ jobId: job._id });
      await analyzeImageJob({ jobId: job._id, imageDataUrl });
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : "再試行に失敗しました");
    }
  };

  const handleRetry = async (
    draftId: string,
    jobs: Doc<"receiptAnalysisImageJobs">[] | undefined,
  ) => {
    setRetryError("");
    const job = jobs?.find((j) => j.draftId === draftId);
    if (!job) {
      setRetryError("再試行対象の画像ジョブが見つかりません");
      return;
    }
    const imageDataUrl = pendingImageDataUrls.get(job._id);
    if (!imageDataUrl) {
      setPendingRetryJob(job);
      retryInputRef.current?.click();
      return;
    }
    await runRetry(job, imageDataUrl);
  };

  const handleRetryFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const job = pendingRetryJob;
    event.target.value = "";
    setPendingRetryJob(null);
    if (!file || !job) {
      return;
    }
    try {
      const imageDataUrl = await resizeImageFileToDataUrl(file);
      await runRetry(job, imageDataUrl);
    } catch (err) {
      setRetryError(getImageFileErrorMessage(err));
    }
  };

  return {
    retryError,
    retryInputRef,
    pendingRetryJob,
    setRetryError,
    setPendingRetryJob,
    handleRetry,
    handleRetryFileSelected,
  };
}
