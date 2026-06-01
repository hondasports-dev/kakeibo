import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const htmlPath = path.join(root, "docs", "ai-expense-flow-demo.html");
const outDir = path.join(root, "docs", "generated", "ai-expense-flow-demo");
const framesDir = path.join(outDir, "frames");
const videoPath = path.join(outDir, "ai-expense-flow-demo.mp4");
const posterPath = path.join(outDir, "ai-expense-flow-demo-poster.png");

const fps = 24;
const durationSeconds = 26;
const width = 1280;
const height = 720;

fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: 1,
});

await page.goto(pathToFileURL(htmlPath).href);
await page.addStyleTag({
  content: `
    * {
      caret-color: transparent !important;
    }
  `,
});

const totalFrames = fps * durationSeconds;
for (let frame = 0; frame < totalFrames; frame += 1) {
  const seconds = frame / fps;
  await page.addStyleTag({
    content: `
      * {
        animation-delay: -${seconds}s !important;
        animation-play-state: paused !important;
      }
    `,
  });
  await page.screenshot({
    path: path.join(framesDir, `frame-${String(frame).padStart(4, "0")}.png`),
    fullPage: false,
  });
}

await page.screenshot({ path: posterPath, fullPage: false });
await browser.close();

const ffmpeg = spawnSync(
  "ffmpeg",
  [
    "-y",
    "-framerate",
    String(fps),
    "-i",
    path.join(framesDir, "frame-%04d.png"),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    videoPath,
  ],
  { stdio: "inherit" },
);

if (ffmpeg.status !== 0) {
  process.exit(ffmpeg.status ?? 1);
}

console.log(videoPath);
