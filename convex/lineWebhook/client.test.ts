import type { ActionCtx } from "../_generated/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LINE_UNLINKED_GUIDANCE_MESSAGE, sendLineTextReply } from "./client";
import { sendUnlinkedGuideHandler } from "./actions";

function setEnvironment(values: Record<string, string | undefined>) {
  const original = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return () => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

describe("LINE messaging client", () => {
  beforeEach(() => {
    process.env.APP_ENV = "development";
  });

  it("mock modeでは外部APIへ送信しない", async () => {
    const restore = setEnvironment({ LINE_INTEGRATION_MODE: "mock" });
    const fetchImpl = vi.fn();
    try {
      await expect(sendLineTextReply("reply-token", fetchImpl)).resolves.toBeUndefined();
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it("internal guide actionもmock client経由で外部APIを呼ばない", async () => {
    const restore = setEnvironment({ LINE_INTEGRATION_MODE: "mock" });
    try {
      await expect(
        sendUnlinkedGuideHandler({} as ActionCtx, { replyToken: "reply-token" }),
      ).resolves.toBeNull();
    } finally {
      restore();
    }
  });

  it("real modeではserver-side access tokenで固定案内を送る", async () => {
    const restore = setEnvironment({
      LINE_INTEGRATION_MODE: "real",
      LINE_MESSAGING_CHANNEL_ACCESS_TOKEN: "access-token-private",
    });
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
    try {
      await sendLineTextReply("reply-token-private", fetchImpl);
      const [, request] = fetchImpl.mock.calls[0] as [string, RequestInit];
      expect(fetchImpl).toHaveBeenCalledWith(
        "https://api.line.me/v2/bot/message/reply",
        expect.objectContaining({ method: "POST" }),
      );
      expect(request.headers).toEqual(
        expect.objectContaining({ Authorization: "Bearer access-token-private" }),
      );
      expect(JSON.parse(String(request.body))).toEqual({
        replyToken: "reply-token-private",
        messages: [{ type: "text", text: LINE_UNLINKED_GUIDANCE_MESSAGE }],
      });
    } finally {
      restore();
    }
  });

  it("real modeのsecret不足とprovider errorを公開処理へ通さない", async () => {
    const restore = setEnvironment({
      LINE_INTEGRATION_MODE: "real",
      LINE_MESSAGING_CHANNEL_ACCESS_TOKEN: undefined,
    });
    try {
      await expect(sendLineTextReply("reply-token", vi.fn())).rejects.toThrow(
        "LINE messaging integration is unavailable",
      );
      const fetchImpl = vi.fn().mockResolvedValue(new Response("failure", { status: 500 }));
      const withToken = setEnvironment({ LINE_MESSAGING_CHANNEL_ACCESS_TOKEN: "token" });
      try {
        await expect(sendLineTextReply("reply-token", fetchImpl)).rejects.toThrow(
          "LINE messaging provider rejected the reply",
        );
      } finally {
        withToken();
      }
    } finally {
      restore();
    }
  });
});
