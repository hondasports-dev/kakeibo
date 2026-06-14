import { useRef, useState, type ChangeEvent } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { getImageFileErrorMessage, resizeImageFileToDataUrl } from "../../utils/imageDataUrl";

export function useImageUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [pendingImageDataUrls, setPendingImageDataUrls] = useState<Map<string, string>>(new Map());
  const [uploadError, setUploadError] = useState("");

  const createBatch = useMutation(api.receiptAnalysisJobs.createBatch);
  const analyzeImageJob = useAction(api.receiptAnalysisJobs.analyzeImageJob);

  const handleFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    let fileDataUrls: string[];
    try {
      fileDataUrls = await Promise.all(files.map(resizeImageFileToDataUrl));
    } catch (err) {
      setUploadError(getImageFileErrorMessage(err));
      event.target.value = "";
      return;
    }

    const result = await createBatch({ fileNames: files.map((f) => f.name) });
    if (!result) {
      event.target.value = "";
      return;
    }

    const nextPending = new Map(pendingImageDataUrls);
    for (let i = 0; i < result.jobs.length; i++) {
      nextPending.set(result.jobs[i]._id, fileDataUrls[i]);
    }
    setPendingImageDataUrls(nextPending);

    for (let i = 0; i < result.jobs.length; i++) {
      analyzeImageJob({ jobId: result.jobs[i]._id, imageDataUrl: fileDataUrls[i] }).catch(() => {
        // fire-and-forget: job failures update status via listJobs subscription and show in UI
      });
    }

    event.target.value = "";
  };

  return {
    cameraInputRef,
    inputRef,
    pendingImageDataUrls,
    uploadError,
    setPendingImageDataUrls,
    setUploadError,
    handleFilesSelected,
  };
}
