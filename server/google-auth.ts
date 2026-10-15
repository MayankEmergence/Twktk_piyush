import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { hash } from "./security";
import { z } from "zod";
const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
  { timeoutDuration: 10000 },
);
export function safeReturn(value: unknown, origin: string) {
  if (typeof value !== "string") return "/account";
  try {
    const url = new URL(value, origin);
    return url.origin === origin &&
      ["/", "/world", "/account", "/admin"].includes(url.pathname)
      ? url.pathname + url.search
      : "/account";
  } catch {
    return "/account";
  }
}
export async function verifyGoogleToken(
  idToken: string,
  clientId: string,
  nonceHash: string,
  keys: JWTVerifyGetKey = googleKeys,
) {
  const { payload } = await jwtVerify(idToken, keys, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
    algorithms: ["RS256"],
    requiredClaims: ["exp", "iat", "sub", "nonce", "email", "email_verified"],
    maxTokenAge: "10 minutes",
  });
  if (
    payload.email_verified !== true ||
    typeof payload.nonce !== "string" ||
    hash(payload.nonce) !== nonceHash ||
    !payload.sub ||
    (payload.azp !== undefined && payload.azp !== clientId)
  )
    throw new Error("Google identity verification failed");
  return {
    email: z.email().max(254).parse(payload.email).toLowerCase(),
    name: typeof payload.name === "string" ? payload.name.slice(0, 60) : "",
  };
}
