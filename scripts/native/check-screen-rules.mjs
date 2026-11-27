#!/usr/bin/env node
/**
 * Real Play release check. Requires a booted iOS simulator running the QA-enabled development build,
 * its Metro server, macOS Vision/Xcode, AXe, and Python 3 with opencv-python, numpy and Pillow.
 * node scripts/native/check-screen-rules.mjs --udid <UUID> --scratch <scratchpad> --family 02 --out <new-directory>
 * Or use --variants compare,fair_share (or space-separated names). Add --locale en|lv|ru.
 * Add --pre-answer to capture just the untouched editor at Large and score each variant once.
 * AXE_BIN and PYTHON can override the executable paths. SCRATCHPAD is an alternative to --scratch.
 * The manifest and family map are variants.json and round5-sheets/index.json underneath the scratchpad.
 * Captures both verdicts at Large and accessibility-extra-large; temporarily changes text size and restores it.
 * Use an exclusive simulator window. --analyze <capture-directory> rechecks saved evidence without a device.
 * Writes report.json, AX trees, PNGs, OCR and raw MP4s. FAIL includes missing evidence. N/A applies to
 * default-size input at XL and wrong answers with a marked verdict, Try again and no playback.
 * Retry-only wrong screens skip proof structure, paint/landings and motion. Text, centring and clearance still apply.
 * Centring compares both editor and checked model centres with the content viewport; the maximum offset is 4 pt.
 * Hairline (info only) scans the editor and checked screenshot for 1-device-pixel lines within 3 pt
 * outside native tile bounds or repeated rectangular faces. UNKNOWN means no complete measurable perimeter.
 * The instruction limit counts painted static lines outside the model, between the prompt and the dock.
 * A signed Minka claim inside the model card is part of the puzzle. Its lines do not count as instructions.
 * Arrival (info only) compares visible model pixels in entry.mp4 during the first 700 ms of the editor.
 * The window starts when the question and Check button first align with the target editor.
 * UNKNOWN explains missing arrival evidence in report.json and never changes the exit code.
 * The pre-Check answer scan checks verdicts, equations and explicit answer text. Pictorial cues need visual review.
 */
import { spawn, execFile } from "node:child_process";
import { parseArgs, promisify } from "node:util";
import { once } from "node:events";
import { editorLayout, sameEditorLayout } from "./screen-rules/editor-layout.mjs";
import { constants } from "node:fs";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const here = path.dirname(fileURLToPath(import.meta.url));
const execute = promisify(execFile);
const options = Object.fromEntries(
  ["udid", "scratch", "family", "variants", "out", "analyze", "locale"].map(
    (key) => [key, { type: "string" }],
  ),
);
const { values: opt, positionals } = parseArgs({
  options: { ...options, "pre-answer": { type: "boolean" }, help: { type: "boolean" } },
  allowPositionals: true,
});
const read = async (file) => JSON.parse(await readFile(file, "utf8"));
const save = (file, value) =>
  writeFile(file, JSON.stringify(value, null, 2) + "\n");
const run = async (cmd, args, timeout = 30000) =>
  (
    await execute(cmd, args, { timeout, maxBuffer: 32 * 1024 * 1024 })
  ).stdout.trim();
const canExecute = async (file) => {
  try {
    await access(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};
function flatten(nodes) {
  return nodes.flatMap((n) => [n, ...flatten(n.children ?? [])]);
}
function fixtureURL(id, locale, mode) {
  const params = new URLSearchParams({
    example: id,
    locale,
    ...(mode ? { autoAnswer: mode, auditFrames: "1" } : {}),
  });
  return `mathmews://puzzle-layout-qa?${params}`;
}
async function findAxe() {
  if (process.env.AXE_BIN) return process.env.AXE_BIN;
  const tmp = process.env.TMPDIR;
  for (const name of (tmp ? await readdir(tmp) : [])
    .filter((s) => s.startsWith("brainpet-b4-"))
    .sort()
    .reverse()) {
    const file = path.join(tmp, name, "native/axe-cli/axe");
    if (await canExecute(file)) return file;
  }
  return "axe";
}
async function recordVideo(udid, file, work) {
  const child = spawn(
    "xcrun",
    ["simctl", "io", udid, "recordVideo", "--codec=h264", "--force", file],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  let log = "";
  child.stderr.on("data", (chunk) => {
    log += chunk;
  });
  const closed = once(child, "close");
  try {
    const deadline = Date.now() + 3500;
    while (
      !/Recording started/i.test(log) &&
      Date.now() < deadline &&
      child.exitCode === null
    )
      await delay(50);
    if (child.exitCode !== null) throw Error(log || "recorder exited");
    await work();
  } finally {
    child.kill("SIGINT");
    const forceStop = setTimeout(() => child.kill("SIGKILL"), 5000);
    try {
      await closed;
    } finally {
      clearTimeout(forceStop);
    }
  }
}
async function capture(folder, config, axe) {
  const { udid, locale } = config;
  const sim = (...args) => run("xcrun", ["simctl", ...args]);
  const tree = async () =>
    JSON.parse(
      await run(axe, ["describe-ui", "--minimal-keys", "--udid", udid]),
    );
  const original = await sim("ui", udid, "content_size");
  const stop = new AbortController();
  const interrupt = () => stop.abort();
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  try {
    for (const size of config.preAnswer ? ["large"] : ["large", "accessibility-extra-large"]) {
      await sim("ui", udid, "content_size", size);
      for (const item of config.cases) {
        const started = Date.now();
        stop.signal.throwIfAborted();
        const dir = path.join(folder, size, item.variant);
        await mkdir(dir, { recursive: true });
        const url = (mode) =>
          sim("openurl", udid, fixtureURL(item.id, locale, mode));
        try {
          // Record the unselected editor before navigation. The verdict runs can auto-submit after 650 ms.
          let entryAttempted = false;
          const captureEntry = async () => {
            entryAttempted = true;
            await url();
            await delay(350);
            let entry;
            let lastLayout;
            let stable = false;
            for (let attempt = 0; attempt < 5; attempt++) {
              entry = await tree();
              const nodes = flatten(entry);
              const question = nodes.find(
                (n) => n.AXUniqueId === "puzzle-question",
              );
              const check = nodes.find(
                (n) => n.type === "Button" && n.AXLabel === config.checkLabel,
              );
              const layout = editorLayout(question, check);
              stable = sameEditorLayout(lastLayout, layout);
              if (stable) break;
              lastLayout = layout;
              await delay(100);
            }
            if (!stable)
              throw Error("Editor did not reach stable native bounds");
            await save(path.join(dir, "entry.json"), entry);
            await sim("io", udid, "screenshot", path.join(dir, "entry.png"));
          };
          try {
            await recordVideo(udid, path.join(dir, "entry.mp4"), async () => {
              await captureEntry();
              await delay(720); // Cover the full arrival window even when layout stabilizes quickly.
            });
          } catch (err) {
            if (entryAttempted) throw err;
            await save(path.join(dir, "arrival-error.json"), String(err));
            await captureEntry();
          }
        } catch (err) {
          await save(path.join(dir, "entry-error.json"), String(err));
        }
        if (config.preAnswer) {
          console.log(`Captured editor ${item.variant}`);
          continue;
        }
        for (const mode of ["correct", "wrong"]) {
          stop.signal.throwIfAborted();
          const prefix = path.join(dir, mode);
          try {
            await recordVideo(udid, prefix + ".mp4", async () => {
              await url(mode);
              await delay(mode === "correct" ? 2050 : 900);
              let deadline = Date.now() + 11000;
              let lastMatched;
              let firstSettledTime;
              let settledConfirmed = false;
              let lastNative;
              do {
                stop.signal.throwIfAborted();
                const native = await tree();
                lastNative = native;
                const nodes = flatten(native);
                const payload = nodes.find(
                  (n) => n.AXUniqueId === "play-proof-audit",
                )?.AXValue;
                if (!payload) {
                  await delay(100);
                  continue;
                }
                const audit = JSON.parse(payload);
                const marked = nodes.some(
                  (n) =>
                    n.type === "Button" && n.AXValue === config.verdict[mode],
                );
                if (
                  audit.puzzleId !== item.id ||
                  !marked ||
                  !audit.events.some((e) => e.phase === "check")
                ) {
                  await delay(100);
                  continue;
                }
                lastMatched = { native, audit };
                const settled = audit.events.findLast((e) => e.phase === "settled");
                if (settled) {
                  if (firstSettledTime === settled.time && Number.isFinite(settled.time)) {
                    settledConfirmed = true;
                    break;
                  }
                  // The audit can settle before AX exposes the final equation. Read AX again.
                  if (firstSettledTime === undefined) deadline = Math.max(deadline, Date.now() + 1000);
                  firstSettledTime = settled.time;
                } else if (mode === "wrong" &&
                    audit.events.every((e) => e.phase === "check") &&
                    nodes.some((n) => n.AXLabel === config.retryLabel) &&
                    !nodes.some((n) => n.AXUniqueId === "play-proof-model") &&
                    Date.now() - audit.events[0].time > 1800) {
                  break;
                }
                await delay(200);
              } while (Date.now() < deadline);
              if (lastMatched && (firstSettledTime === undefined || settledConfirmed)) {
                await save(prefix + ".json", lastMatched);
              } else {
                if (lastNative)
                  await save(prefix + "-unmatched.json", lastNative);
                await save(
                  prefix + "-error.json",
                  firstSettledTime === undefined
                    ? "Expected fixture and marked verdict did not appear before timeout"
                    : "Could not confirm the settled proof in a later native sample",
                );
              }
              await sim("io", udid, "screenshot", prefix + ".png");
            });
          } catch (err) {
            await save(prefix + "-error.json", String(err));
          }
          console.log(`Captured ${size} ${item.variant} ${mode}`);
        }
        await save(path.join(dir, "duration.json"), {
          captureMs: Date.now() - started,
        });
      }
    }
  } finally {
    await sim("ui", udid, "content_size", original);
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", interrupt);
    console.log(`Released simulator ${udid}; restored ${original}.`);
  }
}
async function main() {
  if (opt.help) {
    console.log(
      (await readFile(fileURLToPath(import.meta.url), "utf8"))
        .split("/**")[1]
        .split("*/")[0]
        .replace(/^ \* ?/gm, ""),
    );
    return;
  }
  const folder = path.resolve(
    opt.analyze ?? opt.out ?? `screen-rules-${Date.now()}`,
  );
  const manifest = path.join(folder, "capture.json");
  let config;
  if (opt.analyze) config = await read(manifest);
  else {
    if (
      !opt.udid ||
      Boolean(opt.family) === Boolean(opt.variants || positionals.length)
    )
      throw Error(
        "Specify --udid and either --family or --variants. See --help.",
      );
    const scratch = path.resolve(
      opt.scratch ?? process.env.SCRATCHPAD ?? "scratchpad",
    );
    const locale = opt.locale ?? "en";
    if (!["en", "lv", "ru"].includes(locale)) throw Error("Unsupported locale");
    const rows = await read(path.join(scratch, "variants.json"));
    let names = [opt.variants ?? "", ...positionals]
      .flatMap((v) => v.split(","))
      .filter(Boolean);
    if (opt.family) {
      const { families } = await read(
        path.join(scratch, "round5-sheets/index.json"),
      );
      const query = opt.family.toLowerCase().replaceAll(" ", "-");
      const matches = Object.keys(families).filter(
        (k) => k === query || k.startsWith(query + "-") || k.slice(3) === query,
      );
      if (matches.length !== 1)
        throw Error(`Unknown or ambiguous family ${opt.family}`);
      names = families[matches[0]];
    }
    const cases = [...new Set(names)].map((name) => {
      const item = rows.find((r) => r.variant === name);
      if (!item) throw Error(`Unknown variant ${name}`);
      return item;
    });
    if (!cases.length) throw Error("No matching variants");
    const loc = await read(path.join(here, "../../locales", locale + ".json"));
    config = {
      udid: opt.udid,
      family: opt.family,
      preAnswer: Boolean(opt["pre-answer"]),
      scratch,
      locale,
      cases,
      checkLabel: loc.play.checkAnswer,
      retryLabel: loc.play.tryAgain,
      verdict: { correct: loc.play.answerCorrect, wrong: loc.play.answerWrong },
      answerTemplate: loc.play.answerLabel,
    };
    await mkdir(path.dirname(folder), { recursive: true });
    await mkdir(folder);
    await save(manifest, config);
  }
  const venv = path.join(config.scratch, "venv/bin/python");
  const python =
    process.env.PYTHON ?? ((await canExecute(venv)) ? venv : "python3");
  await run(python, ["-c", "import cv2,numpy,PIL"]);
  const vision = path.join(folder, "recognize");
  await run(
    "xcrun",
    ["swiftc", path.join(here, "screen-rules/recognize.swift"), "-o", vision],
    120000,
  );
  if (!opt.analyze) await capture(folder, config, await findAxe());
  const analyzer = spawn(
    python,
    [path.join(here, config.preAnswer ? "screen-rules/precheck.py" : "screen-rules/analyze.py"), folder, vision],
    { stdio: "inherit" },
  );
  const [code] = await once(analyzer, "close");
  process.exitCode = code ?? 2;
}
main().catch((err) => {
  console.error(err.message);
  process.exitCode = 2;
});
