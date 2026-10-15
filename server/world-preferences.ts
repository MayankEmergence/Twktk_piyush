import { z } from "zod";
const keys = z.enum([
  "twktk_guided",
  "twktk_name",
  "twktk_avatar",
  "twktk_lb",
  "twktk_g_runner",
  "twktk_g_rhythm",
  "twktk_g_simon",
  "twktk_g_maze",
]);
export function validateWorldPrefs(value: unknown) {
  const incoming = z.partialRecord(keys, z.string().max(10000)).parse(value),
    clean: Record<string, string> = {};
  for (const [key, text] of Object.entries(incoming)) {
    if (key === "twktk_guided") clean[key] = z.literal("1").parse(text);
    else if (key === "twktk_name") clean[key] = z.string().max(12).parse(text);
    else if (key.startsWith("twktk_g_"))
      clean[key] = String(
        z.number().int().min(0).max(10000000).parse(Number(text)),
      );
    else if (key === "twktk_avatar")
      clean[key] = JSON.stringify(
        z
          .object({
            c: z.number().int().min(0).max(3),
            f: z.number().int().min(0).max(5),
          })
          .parse(JSON.parse(text)),
      );
    else
      clean[key] = JSON.stringify(
        z
          .partialRecord(
            z.enum(["runner", "rhythm", "simon", "maze"]),
            z
              .array(
                z.object({
                  n: z.string().max(12),
                  s: z.number().int().min(0).max(10000000),
                  t: z.number().int().min(0).max(8640000000000000).optional(),
                }),
              )
              .max(5),
          )
          .parse(JSON.parse(text)),
      );
  }
  return clean;
}
