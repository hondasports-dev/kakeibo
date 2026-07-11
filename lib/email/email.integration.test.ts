import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { ConvexHttpClient } from "convex/browser";
import { internal } from "../../convex/_generated/api.js";
import { normalizeEmail } from "./model";

const execFileAsync = promisify(execFile);

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const isConfigured =
  typeof RESEND_API_KEY === "string" &&
  RESEND_API_KEY.length > 0 &&
  RESEND_API_KEY !== "re_change_me";

const describeWhen = isConfigured ? describe : describe.skip;

const RESEND_TEST_ADDRESSES = {
  delivered: "delivered@resend.dev",
  bounced: "bounced@resend.dev",
  suppressed: "suppressed@resend.dev",
};

function waitForOutput(child: ChildProcess, matcher: string, timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for output: ${matcher}\n${output}`));
    }, timeoutMs);

    function onData(data: Buffer | string) {
      const chunk = typeof data === "string" ? data : data.toString();
      output += chunk;
      if (output.includes(matcher)) {
        clearTimeout(timer);
        cleanup();
        resolve();
      }
    }

    function cleanup() {
      child.stdout?.off("data", onData);
      child.stderr?.off("data", onData);
    }

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("error", (error) => {
      clearTimeout(timer);
      cleanup();
      reject(error);
    });
    child.on("exit", (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timer);
        cleanup();
        reject(new Error(`convex dev exited with code ${code}\n${output}`));
      }
    });
  });
}

async function waitForJob(
  client: ConvexHttpClient,
  jobId: string,
  timeoutMs: number,
): Promise<Record<string, any> | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const job = await client.query(internal.email.internal.getJobById, {
      jobId: jobId as any,
    });
    if (job && job.status !== "queued" && job.status !== "processing") {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return null;
}

async function cleanupTestRecords(client: ConvexHttpClient, email: string): Promise<void> {
  await client.mutation(internal.email.internal.deleteTestEmailRecords, {
    normalizedEmail: normalizeEmail(email),
  });
}

async function getConvexEnv(adminKey: string): Promise<Record<string, string>> {
  const { stdout } = await execFileAsync(
    "node",
    [
      "node_modules/convex/bin/main.js",
      "env",
      "list",
      "--url",
      "http://127.0.0.1:3210",
      "--admin-key",
      adminKey,
    ],
    { cwd: process.cwd() },
  );
  const result: Record<string, string> = {};
  for (const line of stdout.split("\n")) {
    const idx = line.indexOf("=");
    if (idx > 0) {
      result[line.slice(0, idx)] = line.slice(idx + 1);
    }
  }
  return result;
}

async function setConvexEnv(adminKey: string, name: string, value: string): Promise<void> {
  await execFileAsync(
    "node",
    [
      "node_modules/convex/bin/main.js",
      "env",
      "set",
      "--url",
      "http://127.0.0.1:3210",
      "--admin-key",
      adminKey,
      name,
      value,
    ],
    { cwd: process.cwd() },
  );
}

async function removeConvexEnv(adminKey: string, name: string): Promise<void> {
  await execFileAsync(
    "node",
    [
      "node_modules/convex/bin/main.js",
      "env",
      "remove",
      "--url",
      "http://127.0.0.1:3210",
      "--admin-key",
      adminKey,
      name,
    ],
    { cwd: process.cwd() },
  );
}

async function restoreConvexEnv(adminKey: string, original: Record<string, string>): Promise<void> {
  const current = await getConvexEnv(adminKey);
  for (const name of Object.keys(current)) {
    if (name in original) {
      if (current[name] !== original[name]) {
        await setConvexEnv(adminKey, name, original[name]);
      }
    } else {
      await removeConvexEnv(adminKey, name);
    }
  }
  for (const name of Object.keys(original)) {
    if (!(name in current)) {
      await setConvexEnv(adminKey, name, original[name]);
    }
  }
}

describeWhen("transactional email integration", () => {
  let convex: ChildProcess;
  let client: ConvexHttpClient;
  let originalConvexEnv: Record<string, string> | undefined;
  let adminKey: string;

  const testResendFromAddress = "Suzumemo <onboarding@resend.dev>";

  beforeAll(async () => {
    const env = {
      ...process.env,
      CONVEX_AGENT_MODE: "anonymous",
      CLERK_JWT_ISSUER_DOMAIN: process.env.CLERK_JWT_ISSUER_DOMAIN,
    };
    delete env.CONVEX_DEPLOYMENT;

    convex = spawn("node", ["node_modules/convex/bin/main.js", "dev", "--typecheck", "disable"], {
      cwd: process.cwd(),
      env,
      detached: true,
      stdio: "pipe",
    });

    await waitForOutput(convex, "Convex functions ready", 60000);

    const config = JSON.parse(await readFile(".convex/local/default/config.json", "utf8"));
    adminKey = config.adminKey;

    client = new ConvexHttpClient("http://127.0.0.1:3210", {
      skipConvexDeploymentUrlCheck: true,
    });
    client.setAdminAuth(adminKey);

    originalConvexEnv = await getConvexEnv(adminKey);

    await setConvexEnv(adminKey, "RESEND_FROM_ADDRESS", testResendFromAddress);
    await setConvexEnv(adminKey, "RESEND_API_KEY", RESEND_API_KEY);
    await setConvexEnv(adminKey, "APP_ENV", "production");
    if (process.env.CLERK_JWT_ISSUER_DOMAIN && !("CLERK_JWT_ISSUER_DOMAIN" in originalConvexEnv)) {
      await setConvexEnv(adminKey, "CLERK_JWT_ISSUER_DOMAIN", process.env.CLERK_JWT_ISSUER_DOMAIN);
    }
  }, 120000);

  afterEach(async () => {
    for (const email of Object.values(RESEND_TEST_ADDRESSES)) {
      await cleanupTestRecords(client, email);
    }
  }, 60000);

  afterAll(async () => {
    if (convex.pid) {
      try {
        process.kill(-convex.pid, "SIGTERM");
      } catch {
        // 既に終了している場合は無視
      }
    }
    if (originalConvexEnv) {
      await restoreConvexEnv(adminKey, originalConvexEnv);
    }
  }, 10000);

  async function enqueueTestJob(email: string): Promise<string> {
    const payload = JSON.stringify({
      to: email,
      groupName: "Integration Test",
    });
    const jobId = await client.mutation(internal.email.jobs.enqueueTransactionalEmailJob, {
      templateType: "email_delivery_test",
      payloadJson: payload,
      recipientEmail: email,
    });
    return jobId as string;
  }

  it("sends to delivered@resend.dev and records sent status", async () => {
    const jobId = await enqueueTestJob(RESEND_TEST_ADDRESSES.delivered);
    const job = await waitForJob(client, jobId, 30000);

    expect(job).not.toBeNull();
    expect(job?.status).toBe("sent");
    expect(job?.providerMessageId).toMatch(/^\w/);
  }, 60000);

  it("records failed for bounced@resend.dev", async () => {
    const jobId = await enqueueTestJob(RESEND_TEST_ADDRESSES.bounced);
    const job = await waitForJob(client, jobId, 30000);

    expect(job).not.toBeNull();
    expect(job?.status).toBe("failed");
    expect(job?.errorCode).toBeTruthy();
  }, 60000);

  it("records failed for suppressed@resend.dev", async () => {
    const jobId = await enqueueTestJob(RESEND_TEST_ADDRESSES.suppressed);
    const job = await waitForJob(client, jobId, 30000);

    expect(job).not.toBeNull();
    expect(job?.status).toBe("failed");
    expect(job?.errorCode).toBeTruthy();
  }, 60000);
});
