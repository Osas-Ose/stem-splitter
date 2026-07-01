import type { Express } from "express";
import { ENV } from "./env";

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

/**
 * Requests a presigned PUT URL from the forge storage backend so the client
 * can upload a file (e.g. an audio track) directly without routing the
 * bytes through this server. `key` should be a unique storage path such as
 * `tracks/<userId>/<timestamp>-<fileName>`.
 */
export async function getPresignedUploadUrl(key: string, contentType: string) {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    throw new Error("Storage backend not configured");
  }

  const forgeUrl = new URL(
    "v1/storage/presign/put",
    ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
  );
  forgeUrl.searchParams.set("path", key);
  forgeUrl.searchParams.set("contentType", contentType);

  const forgeResp = await fetch(forgeUrl, {
    headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
  });

  if (!forgeResp.ok) {
    const body = await forgeResp.text().catch(() => "");
    throw new Error(`Storage backend error: ${forgeResp.status} ${body}`);
  }

  const { url } = (await forgeResp.json()) as { url: string };
  if (!url) {
    throw new Error("Empty signed upload URL from storage backend");
  }

  return { uploadUrl: url, key };
}
