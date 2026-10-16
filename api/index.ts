import type { VercelRequest, VercelResponse } from "@vercel/node";
import app from "../server/app";

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Ensure req.url matches Express route definitions starting with /api
  if (req.url && !req.url.startsWith("/api") && !req.url.startsWith("/?")) {
    req.url = "/api" + (req.url.startsWith("/") ? req.url : "/" + req.url);
  }
  return app(req as any, res as any);
}
