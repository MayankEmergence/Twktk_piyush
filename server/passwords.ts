import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
const derive = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (err, key) => (err ? reject(err) : resolve(key)),
    ),
  );
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${(await derive(password, salt)).toString("hex")}`;
}
let dummy: Promise<string> | undefined;
export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
) {
  const valid =
    typeof stored === "string" &&
    /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(stored);
  const encoded = valid
    ? stored!
    : await (dummy ||= hashPassword(randomBytes(32).toString("hex")));
  const [, salt, digest] = encoded.split("$");
  const key = await derive(password, salt);
  return valid && timingSafeEqual(key, Buffer.from(digest, "hex"));
}
