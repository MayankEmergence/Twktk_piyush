import { randomUUID } from "node:crypto";
import type { Response } from "express";
import type { PoolClient } from "pg";
import { hash, token } from "./security";
export async function createSession(
  client: PoolClient,
  email: string,
  name = "",
  options: { remember?: boolean; passwordHash?: string } = {},
) {
  const user = (
    await client.query(
      "INSERT INTO users(id,email,full_name,password_hash) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO UPDATE SET full_name=CASE WHEN users.full_name='' THEN EXCLUDED.full_name ELSE users.full_name END,password_hash=coalesce(users.password_hash,EXCLUDED.password_hash) RETURNING id",
      [randomUUID(), email, name, options.passwordHash || null],
    )
  ).rows[0];
  const sessionToken = token();
  await client.query(
    "INSERT INTO sessions(hash,user_id,expires_at) VALUES($1,$2,now()+($3::int*interval '1 hour'))",
    [hash(sessionToken), user.id, options.remember ? 720 : 8],
  );
  return sessionToken;
}
export function setSessionCookie(
  response: Response,
  value: string,
  production: boolean,
  remember = false,
) {
  response.cookie(production ? "__Host-twktk" : "twktk", value, {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: "/",
    ...(remember ? { maxAge: 30 * 86400000 } : {}),
  });
}
