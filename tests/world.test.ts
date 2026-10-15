import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { validateWorldPrefs } from "../server/world-preferences";
test("the original venue coordinates, colliders and interactive stall actions are preserved", async () => {
  const fixture = JSON.parse(
    await readFile(
      new URL("./fixtures/original-world.json", import.meta.url),
      "utf8",
    ),
  );
  const restored = (
    await readFile(
      new URL("../src/experience/world.js", import.meta.url),
      "utf8",
    )
  ).replaceAll("\r\n", "\n");
  for (const section of fixture.sections) {
    const start = restored.indexOf(section.start);
    assert.ok(start >= 0, section.start + " retained");
    assert.equal(
      restored.slice(start, start + section.text.length),
      section.text,
      section.start + " retains the original map",
    );
  }
  assert.deepEqual(
    [...restored.matchAll(/addIx\([^\n]+/g)].map((m) => m[0]),
    fixture.interactions,
  );
  assert.deepEqual(
    [...restored.matchAll(/\{u:[^\n]+,n:[^\n]+/g)].map((m) => m[0]),
    fixture.landmarks,
  );
});
test("world persistence accepts a first arcade score and rejects unsafe score values", () => {
  const prefs = validateWorldPrefs({
    twktk_lb: JSON.stringify({ runner: [{ n: "OPERATIVE", s: 42, t: 1 }] }),
    twktk_g_runner: "42",
    twktk_avatar: '{"c":0,"f":5}',
  });
  assert.equal(JSON.parse(prefs.twktk_lb).runner[0].s, 42);
  assert.throws(() =>
    validateWorldPrefs({ twktk_lb: '{"runner":[{"n":"name","s":"<img>"}]}' }),
  );
  assert.throws(() => validateWorldPrefs({ twktk_avatar: '{"c":99,"f":0}' }));
  assert.throws(() => validateWorldPrefs({ admin: "true" }));
});
