import express from "express";
import { makeRenderQueue } from "./render-queue";
import { bundle } from "@remotion/bundler";
import path from "node:path";
import { ensureBrowser } from "@remotion/renderer";

const { PORT = 3000, REMOTION_SERVE_URL } = process.env;

function setupApp({ remotionBundleUrl }: { remotionBundleUrl: string }) {
  const app = express();

  const rendersDir = path.resolve("renders");

  const queue = makeRenderQueue({
    port: Number(PORT),
    serveUrl: remotionBundleUrl,
    rendersDir,
  });

  app.use(express.json());
  app.use("/renders", express.static(rendersDir));

  // CREATE JOB
  app.post("/renders", async (req, res) => {
    const titleText = req.body?.titleText || "Hello, world!";

    if (typeof titleText !== "string") {
      return res.status(400).json({ message: "titleText must be a string" });
    }

    const jobId = queue.createJob({ titleText });

    // timeout safety (Railway protection)
    setTimeout(() => {
      const job = queue.jobs.get(jobId);
      if (!job) return;

      if (job.status === "queued" || job.status === "in-progress") {
        job.status = "failed";
        job.error = "timeout";
      }
    }, 1000 * 60 * 8);

    res.json({
      jobId,
      status: "queued",
    });
  });

  // GET STATUS (polling safe format)
  app.get("/renders/:jobId", (req, res) => {
    const jobId = req.params.jobId;
    const job = queue.jobs.get(jobId);

    if (!job) {
      return res.status(404).json({ status: "not-found" });
    }

    res.json({
      id: job.id ?? jobId,
      status: job.status,
      progress: job.progress ?? 0,
      output: job.output ?? null,
      error: job.error ?? null,
    });
  });

  // CANCEL
  app.delete("/renders/:jobId", (req, res) => {
    const jobId = req.params.jobId;
    const job = queue.jobs.get(jobId);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (job.status !== "queued" && job.status !== "in-progress") {
      return res.status(400).json({ message: "Job is not cancellable" });
    }

    job.cancel();

    res.json({ message: "Job cancelled" });
  });

  return app;
}

async function main() {
  await ensureBrowser();

  const remotionBundleUrl = REMOTION_SERVE_URL
    ? REMOTION_SERVE_URL
    : await bundle({
        entryPoint: path.resolve("remotion/index.ts"),
        onProgress(progress) {
          console.info(`Bundling Remotion project: ${progress}%`);
        },
      });

  const app = setupApp({ remotionBundleUrl });

  app.listen(PORT, () => {
    console.info(`Server is running on port ${PORT}`);
  });
}

main();
