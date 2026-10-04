import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { chromium } from "playwright";

const DEFAULT_AUDIO = path.join(os.homedir(), "Desktop/hackaton/audios-tratados/05-volta-quixada.m4a");

function option(name, env, fallback) {
  const flag = process.argv.indexOf(`--${name}`);
  if (flag > -1 && process.argv[flag + 1] && !process.argv[flag + 1].startsWith("--")) return process.argv[flag + 1];
  return process.env[env] || fallback;
}
const flag = (name, env) => process.argv.includes(`--${name}`) || process.env[env] === "1";

const settings = {
  base: option("url", "THREAD_DEMO_URL", `http://localhost:${process.env.THREAD_DEMO_PORT || 3210}`).replace(/\/$/, ""),
  audio: path.resolve(option("audio", "THREAD_DEMO_AUDIO", DEFAULT_AUDIO)),
  takeDir: path.resolve(option("take-dir", "THREAD_DEMO_DIR", path.join(os.tmpdir(), "thread-demo-take"))),
  viewport: option("viewport", "THREAD_DEMO_VIEWPORT", "auto"),
  colorScheme: option("color-scheme", "THREAD_DEMO_COLOR_SCHEME", "dark"),
  openingStory: option("opening-story", "THREAD_DEMO_OPENING_STORY", "Chegada a Fortaleza e visão do mar"),
  person: option("person", "THREAD_DEMO_PERSON", "José"),
  evidence: option("evidence", "THREAD_DEMO_EVIDENCE", ""),
  processingMinutes: Number(option("processing-timeout", "THREAD_DEMO_PROCESSING_MINUTES", "20")),
  keepOpen: flag("keep-open", "THREAD_DEMO_KEEP_OPEN"),
};
const FRAMES = [
  [1440, 810],
  [1280, 720],
];
const EXPECTED_BEFORE = 4;

class DemoError extends Error {}

const startedAt = Date.now();
function log(text) {
  const s = (Date.now() - startedAt) / 1000;
  console.log(`${String(Math.floor(s / 60)).padStart(2, "0")}:${(s % 60).toFixed(1).padStart(4, "0")}  ${text}`);
}

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sha256 = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function originalsIn(dir) {
  const recordings = path.join(dir, "recordings");
  if (!fs.existsSync(recordings)) return [];
  return fs.readdirSync(recordings).flatMap((id) =>
    fs
      .readdirSync(path.join(recordings, id))
      .filter((file) => file.startsWith("original."))
      .map((file) => ({ id, file: path.join(recordings, id, file) })),
  );
}

async function readRecordings(page) {
  await page.goto(`${settings.base}/recordings`);
  await page.getByRole("heading", { level: 1, name: "Recordings" }).waitFor();
  const readOnly = await page.getByText(/read-only/i).count();
  const summary = (await page.getByText(/^\d+ recordings? · /).textContent().catch(() => null)) ?? "";
  const links = page.locator('main a[href^="/recordings/"]');
  const rows = await links.evaluateAll((items) =>
    items.map((a) => ({ id: a.getAttribute("href").split("/").pop(), text: a.textContent ?? "" })),
  );
  return { readOnly: readOnly > 0, summaryCount: Number(summary.match(/^(\d+)/)?.[1] ?? NaN), rows };
}

async function preflight() {
  if (settings.viewport !== "auto" && !/^\d+x\d+$/.test(settings.viewport)) throw new DemoError(`Invalid viewport “${settings.viewport}”. Use auto or WIDTHxHEIGHT, like 1280x720.`);
  if (!fs.existsSync(settings.audio) || !fs.statSync(settings.audio).isFile()) {
    throw new DemoError(`The fifth audio was not found at ${settings.audio}. Pass it with --audio <path> or THREAD_DEMO_AUDIO.`);
  }
  const audioSum = sha256(settings.audio);
  const audioName = path.basename(settings.audio);
  log(`fifth audio: ${settings.audio} (sha256 ${audioSum.slice(0, 12)})`);

  if (fs.existsSync(settings.takeDir)) {
    const already = originalsIn(settings.takeDir).find((o) => sha256(o.file) === audioSum);
    if (already) throw new DemoError(`The fifth audio is already in the take archive as recording ${already.id}. Reset the take first.`);
  } else {
    log(`take archive ${settings.takeDir} not found locally, so only the interface checks run`);
  }

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    const response = await page.goto(settings.base, { timeout: 15000 }).catch(() => null);
    if (!response?.ok()) throw new DemoError(`Thread is not answering at ${settings.base}. Start it with: npm run serve (in demo/video).`);
    const { readOnly, summaryCount, rows } = await readRecordings(page);
    if (readOnly) throw new DemoError("This Thread is running read-only, so nothing can be imported. Start it with: npm run serve (in demo/video).");
    if (rows.length !== EXPECTED_BEFORE || summaryCount !== EXPECTED_BEFORE) {
      throw new DemoError(`The archive must start with exactly ${EXPECTED_BEFORE} recordings, it shows ${rows.length} (summary: ${summaryCount}). Reset the take.`);
    }
    if (rows.some((r) => r.text.includes(audioName))) throw new DemoError(`A recording named ${audioName} is already in the archive. Reset the take.`);
    log(`preflight ok: ${rows.length} recordings, fifth audio not in the archive`);
    return { audioName, before: rows.map((r) => r.id) };
  } finally {
    await browser.close();
  }
}

async function frameWindow(context, page) {
  await page.goto("about:blank");
  const cdp = await context.newCDPSession(page);
  const { windowId } = await cdp.send("Browser.getWindowForTarget");
  await cdp.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "normal" } });
  const measure = () => page.evaluate(() => ({ inner: [innerWidth, innerHeight], outer: [outerWidth, outerHeight], avail: [screen.availWidth, screen.availHeight], dpr: devicePixelRatio }));
  const before = await measure();
  const toolbar = before.outer[1] - before.inner[1];
  const room = [before.avail[0], before.avail[1] - toolbar];
  const wanted = settings.viewport === "auto" ? FRAMES.find(([w, h]) => w <= room[0] && h <= room[1]) : settings.viewport.split("x").map(Number);
  if (!wanted || wanted[0] > room[0] || wanted[1] > room[1]) {
    throw new DemoError(`A ${wanted ? wanted.join("×") : "16:9"} page does not fit on this screen: the browser can show at most ${room.join("×")} points. Hide the Dock or choose a smaller --viewport.`);
  }
  await cdp.send("Browser.setWindowBounds", { windowId, bounds: { left: 0, top: 0, width: wanted[0], height: wanted[1] + toolbar } });
  await page.waitForTimeout(400);
  const after = await measure();
  if (after.inner[0] !== wanted[0] || after.inner[1] !== wanted[1]) {
    throw new DemoError(`The browser shows ${after.inner.join("×")} instead of ${wanted.join("×")}.`);
  }
  const { bounds } = await cdp.send("Browser.getWindowBounds", { windowId });
  log(`page ${wanted.join("×")} at ${after.dpr}x · capture the screen region x ${bounds.left}, y ${bounds.top + toolbar}, ${wanted.join(" × ")} points`);
}

async function main() {
  const { audioName, before } = await preflight();

  const browser = await chromium.launch({
    channel: "chrome",
    headless: false,
    ignoreDefaultArgs: ["--enable-automation"],
    args: ["--window-position=0,0"],
  });
  const context = await browser.newContext({ viewport: null, colorScheme: settings.colorScheme, locale: "en-US" });
  const page = await context.newPage();
  await frameWindow(context, page).catch(async (error) => {
    await browser.close();
    throw error;
  });

  const hold = (seconds) => page.waitForTimeout(seconds * 1000);
  const audio = () =>
    page.evaluate(() => {
      const a = document.querySelector("audio");
      return a ? { src: a.getAttribute("src") ?? "", paused: a.paused, time: a.currentTime } : null;
    });

  async function waitPlaying(recordingId) {
    await page.waitForFunction(
      (id) => {
        const a = document.querySelector("audio");
        return !!a && !a.paused && a.readyState >= 3 && (a.getAttribute("src") ?? "").endsWith(`/api/recordings/${id}/audio`);
      },
      recordingId,
      { timeout: 20000 },
    );
    return (await audio()).time;
  }

  async function listen(seconds) {
    const from = (await audio()).time;
    await page.waitForFunction(
      ([start, length]) => {
        const a = document.querySelector("audio");
        return !a || a.paused || a.currentTime >= start + length;
      },
      [from, seconds],
      { timeout: (seconds + 30) * 1000, polling: 100 },
    );
    const now = await audio();
    if (now.paused) throw new DemoError(`The audio stopped by itself after ${(now.time - from).toFixed(1)} s.`);
    return now.time - from;
  }

  async function expectPaused() {
    await page.waitForFunction(() => document.querySelector("audio")?.paused === true, null, { timeout: 5000 });
  }

  async function settle() {
    let last = await page.evaluate(() => window.scrollY);
    for (let stable = 0; stable < 2; ) {
      await sleep(200);
      const now = await page.evaluate(() => window.scrollY);
      stable = Math.abs(now - last) < 1 ? stable + 1 : 0;
      last = now;
    }
  }

  async function glide(locator, block = "center") {
    await locator.evaluate((el, where) => el.scrollIntoView({ behavior: "smooth", block: where }), block);
    await settle();
  }

  async function toTop() {
    if ((await page.evaluate(() => window.scrollY)) < 1) return;
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await settle();
  }

  const nav = () => page.getByRole("navigation", { name: /life archive$/ });
  async function openSection(name, url) {
    await toTop();
    await nav().getByRole("link", { name, exact: true }).click();
    await page.waitForURL(url);
  }

  const ready = () => page.evaluate(() => document.fonts.ready.then(() => true));
  const lifeline = () => page.getByRole("region", { name: /life, with the moments where a voice was kept$/ });
  const storyMark = (title) => lifeline().getByRole("button", { name: new RegExp(`^${escape(title)}\\. `) });

  const status = async (id) => {
    const response = await page.request.get(`${settings.base}/api/recordings/${id}?after=1000000`);
    if (!response.ok()) throw new DemoError(`The status of recording ${id} could not be read (${response.status()}).`);
    return response.json();
  };

  try {
    log("1 · Life");
    await page.goto(`${settings.base}/`);
    await lifeline().waitFor();
    await ready();
    await hold(5);

    log(`2 · opening “${settings.openingStory}”`);
    const opening = storyMark(settings.openingStory);
    if (await opening.isVisible()) {
      await opening.click();
      await hold(2);
      await page.getByRole("link", { name: /^Read what was said/ }).click();
    } else {
      log("   its mark is grouped on the lifeline, opening it from Stories");
      await openSection("Stories", /\/stories$/);
      await hold(1.5);
      await page.getByRole("link", { name: settings.openingStory, exact: true }).click();
    }
    await page.waitForURL(/\/stories\/[a-z0-9]+$/);
    await page.getByRole("heading", { level: 1, name: settings.openingStory }).waitFor();
    const openingRecording = (await page.getByRole("link", { name: /^From the recording of/ }).getAttribute("href")).split("/").pop();
    await hold(2);

    const quote = page.getByRole("figure").getByRole("button");
    await quote.click();
    const quoteFrom = await waitPlaying(openingRecording);
    log(`   playing the original voice from ${quoteFrom.toFixed(1)} s`);
    await listen(6.8);
    await quote.click();
    await expectPaused();
    log("   paused");
    await hold(1.2);

    log(`3 · People → ${settings.person}`);
    await openSection("People", /\/people$/);
    await page.getByRole("heading", { level: 1, name: "People" }).waitFor();
    await hold(1.5);
    const person = page.getByRole("link", { name: settings.person, exact: true });
    if (!(await person.evaluate((el) => el.getBoundingClientRect().bottom < innerHeight - 40))) {
      await glide(person, "center");
      await hold(0.8);
    }
    await person.click();
    await page.waitForURL(/\/people\/[a-z0-9]+$/);
    await page.getByRole("heading", { level: 1, name: settings.person }).waitFor();
    log(`   ${await page.getByText(/^\d+ stor(y|ies) · \d+ moments?$/).first().textContent()}`);
    await hold(4.5);

    log("4 · Recordings before the import");
    await openSection("Recordings", /\/recordings$/);
    await page.getByRole("heading", { level: 1, name: "Recordings" }).waitFor();
    const shown = await page.locator('main a[href^="/recordings/"]').count();
    const summary = await page.getByText(/^\d+ recordings? · /).textContent();
    if (shown !== EXPECTED_BEFORE || !summary.startsWith(`${EXPECTED_BEFORE} recordings`)) {
      throw new DemoError(`Recordings shows ${shown} (“${summary}”), expected ${EXPECTED_BEFORE}.`);
    }
    log(`   ${summary}`);
    await hold(3);

    log(`5 · Import ${audioName}`);
    await page.getByRole("banner").getByRole("button", { name: "Add a story" }).click();
    const menu = page.getByRole("group", { name: /^Add to .+ archive$/ });
    await menu.waitFor();
    await hold(1.2);
    const chooser = page.waitForEvent("filechooser");
    await menu.getByRole("button", { name: /^Import a recording/ }).click();
    await (await chooser).setFiles(settings.audio);
    await page.waitForURL(/\/recordings\/[a-z0-9]+$/, { timeout: 120000 });
    const newId = new URL(page.url()).pathname.split("/").pop();
    if (before.includes(newId)) throw new DemoError(`The import opened an existing recording (${newId}).`);
    log(`   imported as recording ${newId}`);

    log("6 · processing");
    const processingFrom = Date.now();
    const deadline = Date.now() + settings.processingMinutes * 60000;
    let last = "";
    let state;
    for (;;) {
      state = await status(newId);
      let label = state.failedStage ? `failed while ${state.failedStage}` : state.waiting ? `${state.stage} (waiting in the queue)` : state.stage;
      if (!state.failedStage && state.detail) {
        try {
          const detail = JSON.parse(state.detail);
          if (detail.annotating) label += ` · story ${detail.annotating} of ${detail.total}`;
        } catch {}
      }
      if (label !== last) log(`   ${label}`);
      last = label;
      if (state.failedStage) {
        throw new DemoError(`Processing failed while ${state.failedStage}: ${state.error?.message ?? "no message"}\n${state.error?.detail ?? ""}`);
      }
      if (state.stage === "ready") break;
      if (Date.now() > deadline) throw new DemoError(`Processing did not finish in ${settings.processingMinutes} minutes (last stage: ${state.stage}).`);
      await sleep(1000);
    }
    log(`   processed in ${((Date.now() - processingFrom) / 1000).toFixed(0)} s`);
    if (!state.stories.length) throw new DemoError("Processing finished, but no story was found in the fifth recording.");

    log("7 · the new memory");
    const found = page.getByRole("region", { name: "What the archive found in it" });
    await found.waitFor({ timeout: 60000 });
    await hold(1.5);
    await glide(found.getByRole("heading", { name: "What the archive found in it" }), "center");
    await hold(3.5);
    const richness = (s) => s.people.length + s.places.length + (s.when ? 1 : 0);
    const chosen = [...state.stories].sort((a, b) => richness(b) - richness(a) || a.ord - b.ord)[0];
    log(`   ${state.stories.length} ${state.stories.length === 1 ? "story" : "stories"}: ${state.stories.map((s) => `“${s.title}”`).join(", ")}`);
    log(`   opening “${chosen.title}” (${[chosen.when?.label, ...chosen.people, ...chosen.places].filter(Boolean).join(" · ")})`);
    await found.locator(`a[href="/stories/${chosen.id}"]`).first().click();
    await page.waitForURL(new RegExp(`/stories/${chosen.id}$`));
    const title = (await page.getByRole("heading", { level: 1 }).textContent()).trim();
    await hold(3.5);

    log("8 · the fifth recording’s voice");
    const newQuote = page.getByRole("figure").getByRole("button");
    const fromQuote = (await newQuote.count()) > 0;
    const play = fromQuote ? newQuote : page.getByRole("button", { name: /^Listen: / });
    await play.click();
    const newFrom = await waitPlaying(newId);
    log(`   playing ${fromQuote ? "its quote" : "the story"} from ${newFrom.toFixed(1)} s`);
    await listen(7);
    if (fromQuote) await newQuote.click();
    else await page.getByRole("button", { name: /^Pause: / }).click();
    await expectPaused();
    log("   paused");
    await hold(1.2);

    log("9 · interpretation and provenance");
    const inThisStory = page.getByRole("region", { name: "In this story" });
    if (await inThisStory.count()) {
      await glide(inThisStory, "center");
      const notes = await inThisStory.locator("p").evaluateAll((items) => {
        const counts = { said: 0, extracted: 0, inferred: 0 };
        for (const p of items) {
          const text = (p.textContent ?? "").trim();
          if (text === "said") counts.said++;
          else if (text.startsWith("from “")) counts.extracted++;
          else if (text === "inferred") counts.inferred++;
        }
        return counts;
      });
      log(`   notes: ${notes.said} said · ${notes.extracted} from the words · ${notes.inferred} inferred`);
      await hold(2.5);
      await inThisStory.getByText("How to read the notes").click();
      await hold(4.5);
    } else {
      log("   this story has no people, places or dates to show");
    }

    log("10 · back to the evidence");
    const transcript = page.getByRole("region", { name: "Transcript" });
    const evidence = transcript.locator('button[aria-label^="Play from"]');
    const candidates = await evidence.evaluateAll((buttons) =>
      buttons.map((button, index) => {
        const line = button.closest("p");
        const text = (line?.textContent ?? "").trim();
        const name = (line?.previousElementSibling?.textContent ?? "").trim();
        const kind = !line ? null : text.startsWith("from “") ? "extracted" : text.startsWith("said") ? "said" : text.startsWith("inferred") ? "inferred" : null;
        return { index, kind, name, text, clock: button.textContent.trim() };
      }),
    );
    const rank = (c) =>
      c.kind === "extracted" ? 0 : c.kind === "said" && c.name.endsWith("· when") ? 1 : c.kind === "said" && c.name.endsWith("· place") ? 2 : c.kind === "said" ? 3 : 4;
    const usable = candidates.filter((c) => c.kind);
    const pick = settings.evidence
      ? usable.find((c) => c.name.toLowerCase().startsWith(settings.evidence.toLowerCase()))
      : usable.sort((a, b) => rank(a) - rank(b) || a.index - b.index)[0];
    if (!pick) {
      throw new DemoError(
        settings.evidence
          ? `No evidence named “${settings.evidence}” in the new story. It has: ${usable.map((c) => c.name).join(", ")}.`
          : "The new story has no evidence to play from.",
      );
    }
    log(`   ${pick.name} · ${pick.text}`);
    const target = evidence.nth(pick.index);
    await glide(target, "center");
    await hold(2);
    const [minutes, seconds] = pick.clock.split(":").map(Number);
    const expected = chosen.start + minutes * 60 + seconds - 0.6;
    await target.click();
    const evidenceFrom = await waitPlaying(newId);
    if (Math.abs(evidenceFrom - expected) > 1.6) {
      throw new DemoError(`The evidence started at ${evidenceFrom.toFixed(1)} s, expected about ${expected.toFixed(1)} s.`);
    }
    log(`   playing the voice from ${evidenceFrom.toFixed(1)} s`);
    await listen(5.5);
    await page.getByRole("button", { name: /^Pause: / }).click();
    await expectPaused();
    log("   paused");
    await hold(1.2);

    log("11 · Life with the new memory");
    await openSection("Life", new RegExp(`^${escape(settings.base)}/?$`));
    await lifeline().waitFor();
    await hold(2.5);
    const newMark = storyMark(title);
    if (await newMark.isVisible()) {
      await newMark.click();
      log(`   opened “${title}” on the lifeline`);
    } else {
      log(`   “${title}” has no mark of its own on the lifeline`);
    }
    await hold(5);
    log("end of take");

    if (settings.keepOpen) {
      const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
      await prompt.question("Press Enter to close the browser.");
      prompt.close();
    }
    await browser.close();

    const check = await chromium.launch({ channel: "chrome", headless: true });
    try {
      const after = await readRecordings(await check.newPage());
      if (after.rows.length !== EXPECTED_BEFORE + 1 || after.summaryCount !== EXPECTED_BEFORE + 1) {
        throw new DemoError(`After the take, Recordings shows ${after.rows.length} (summary: ${after.summaryCount}), expected ${EXPECTED_BEFORE + 1}.`);
      }
      const added = after.rows.find((r) => r.id === newId);
      if (!added?.text.includes(audioName)) throw new DemoError(`Recording ${newId} is not listed as ${audioName}.`);
      log(`✓ ${after.rows.length} recordings, the new one is ${newId} (${audioName})`);
    } finally {
      await check.close();
    }
  } catch (error) {
    await browser.close().catch(() => undefined);
    throw error;
  }
}

main().catch((error) => {
  console.error(`\n✗ ${error instanceof DemoError ? error.message : error.stack ?? error}`);
  process.exit(1);
});
