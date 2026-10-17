import type { VercelRequest, VercelResponse } from "@vercel/node";
import app from "./app";

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Restore original matched path from Vercel header if rewritten
  const matchedPath = (req.headers["x-matched-path"] as string) || req.url || "/";
  if (matchedPath && matchedPath !== "/api/index") {
    req.url = matchedPath;
  }
  // Ensure req.url matches Express route definitions starting with /api
  if (req.url && !req.url.startsWith("/api") && !req.url.startsWith("/?")) {
    req.url = "/api" + (req.url.startsWith("/") ? req.url : "/" + req.url);
  }
  return app(req as any, res as any);
}
