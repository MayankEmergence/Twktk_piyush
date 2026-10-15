import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from "jose";
import { verifyGoogleToken, safeReturn } from "../server/google-auth";
import { hash } from "../server/security";
test("Google login rejects wrong nonce, audience, expired and unverified identities", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "test-key";
  const keys = createLocalJWKSet({ keys: [jwk] });
  const sign = (extra: Record<string, unknown> = {}) =>
    new SignJWT({
      email: "guest@gmail.com",
      email_verified: true,
      nonce: "nonce",
      name: "Guest",
      ...extra,
    })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer("https://accounts.google.com")
      .setAudience("client")
      .setSubject("google-user")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
  const valid = await sign();
  assert.deepEqual(
    await verifyGoogleToken(valid, "client", hash("nonce"), keys),
    { email: "guest@gmail.com", name: "Guest" },
  );
  await assert.rejects(() =>
    verifyGoogleToken(valid, "client", hash("wrong"), keys),
  );
  await assert.rejects(() =>
    verifyGoogleToken(valid, "other-client", hash("nonce"), keys),
  );
  await assert.rejects(() =>
    verifyGoogleToken(
      valid.slice(0, -10) + "invalid",
      "client",
      hash("nonce"),
      keys,
    ),
  );
  await assert.rejects(() =>
    sign({ email_verified: false }).then((t) =>
      verifyGoogleToken(t, "client", hash("nonce"), keys),
    ),
  );
  await assert.rejects(() =>
    sign({ azp: "other-client" }).then((t) =>
      verifyGoogleToken(t, "client", hash("nonce"), keys),
    ),
  );
  const expired = await new SignJWT({
    email: "guest@gmail.com",
    email_verified: true,
    nonce: "nonce",
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer("https://accounts.google.com")
    .setAudience("client")
    .setSubject("user")
    .setIssuedAt(1)
    .setExpirationTime(2)
    .sign(privateKey);
  await assert.rejects(() =>
    verifyGoogleToken(expired, "client", hash("nonce"), keys),
  );
});
test("OAuth return URLs stay on allowed pages at the configured origin", () => {
  const origin = "https://www.thosewhoknowtheyknow.com";
  assert.equal(
    safeReturn("/?city=delhi&phase=world&box=1", origin),
    "/?city=delhi&phase=world&box=1",
  );
  for (const path of [
    "https://evil.example",
    "//evil.example",
    "/api/admin/export",
    "javascript:alert(1)",
  ])
    assert.equal(safeReturn(path, origin), "/account");
});
