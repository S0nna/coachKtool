import http from "node:http";
import https from "node:https";
import { existsSync, readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const HOST = "127.0.0.1";
const PORT = Number(process.env.COACHKTOOL_PORT || 32145);
const lockfileCandidates = [
  process.env.LEAGUE_CLIENT_LOCKFILE,
  "C:\\Riot Games\\League of Legends\\lockfile",
  "C:\\Program Files\\Riot Games\\League of Legends\\lockfile",
  "C:\\Program Files (x86)\\Riot Games\\League of Legends\\lockfile",
].filter(Boolean);

function lockfilePath() {
  return lockfileCandidates.find((path) => existsSync(path));
}
function parseLockfile(text) {
  const parts = text.trim().split(":");
  if (parts.length !== 5 || parts[4] !== "https" || !/^\d+$/.test(parts[2]) || !parts[3]) {
    throw new Error("The League Client lockfile has an unsupported format.");
  }
  return { port: Number(parts[2]), password: parts[3] };
}
function localJson(port, password, path) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`riot:${password}`).toString("base64");
    const request = https.request({
      hostname: "127.0.0.1", port, path, method: "GET", rejectUnauthorized: false,
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" }, timeout: 6000,
    }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`League Client returned HTTP ${response.statusCode}.`)); return;
        }
        try { resolve(JSON.parse(body)); } catch { reject(new Error("League Client returned invalid JSON.")); }
      });
    });
    request.on("timeout", () => request.destroy(new Error("League Client request timed out.")));
    request.on("error", reject);
    request.end();
  });
}
let catalogCache = null;
async function championCatalog() {
  if (catalogCache && Date.now() - catalogCache.loadedAt < 12 * 60 * 60 * 1000) return catalogCache;
  const versionsResponse = await fetch("https://ddragon.leagueoflegends.com/api/versions.json", { signal: AbortSignal.timeout(15000) });
  if (!versionsResponse.ok) throw new Error("Could not load Riot Data Dragon version information.");
  const versions = await versionsResponse.json();
  const version = versions?.[0];
  if (typeof version !== "string") throw new Error("Riot Data Dragon returned an invalid version list.");
  const championResponse = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`, { signal: AbortSignal.timeout(15000) });
  if (!championResponse.ok) throw new Error("Could not load Riot champion information.");
  const body = await championResponse.json();
  const champions = Object.values(body.data || {});
  const names = Object.fromEntries(champions.map((champion) => [Number(champion.key), champion.name]));
  const tags = Object.fromEntries(champions.map((champion) => [Number(champion.key), champion.tags || []]));
  catalogCache = { loadedAt: Date.now(), names, tags };
  return catalogCache;
}
const roleAliases = new Map([
  ["top", "top"], ["jungle", "jungle"], ["middle", "middle"], ["mid", "middle"],
  ["bottom", "bottom"], ["bot", "bottom"], ["utility", "utility"], ["support", "utility"],
]);
const mainSupports = new Set([
  "alistar", "bard", "blitzcrank", "braum", "janna", "karma", "leona", "lulu", "milio", "nami",
  "nautilus", "rell", "renata glasc", "rakan", "soraka", "sona", "tahm kench", "taric", "thresh", "yuumi",
]);
const flexSupports = new Set([
  "ashe", "brand", "fiddlesticks", "galio", "heimerdinger", "hwei", "ivern", "lux", "maokai", "morgana",
  "neeko", "pantheon", "poppy", "senna", "seraphine", "shaco", "shen", "swain", "vel'koz", "xerath", "zyra",
]);
const botCarries = new Set([
  "aphelios", "ashe", "caitlyn", "draven", "ezreal", "jhin", "jinx", "kai'sa", "kalista", "kog'maw", "lucian",
  "miss fortune", "nilah", "sivir", "smolder", "tristana", "twitch", "varus", "vayne", "xayah",
]);
const apBotCarries = new Set(["cassiopeia", "karthus", "seraphine", "swain", "veigar", "ziggs"]);
function assignedRole(player) {
  return roleAliases.get(String(player.assignedPosition || "").toLowerCase()) || null;
}
function playerPick(session, player) {
  const cellId = player.cellId;
  const actions = (session.actions || []).flat().filter((action) => action?.type === "pick" && action.actorCellId === cellId);
  const latest = actions.at(-1);
  return Number(player.championId || latest?.championId || player.championPickIntent || 0) || null;
}
function botRoleScores(entry, tagsById) {
  const name = entry.name.toLowerCase();
  const tags = tagsById[entry.id] || [];
  let adc = tags.includes("Marksman") ? 85 : 0;
  if (botCarries.has(name)) adc += 35;
  if (apBotCarries.has(name)) adc += 70;
  let support = tags.includes("Support") ? 60 : 0;
  if (mainSupports.has(name)) support += 45;
  if (flexSupports.has(name)) support += 15;
  return { adc, support };
}
function inferEnemyBotLane(candidates, result, claimedRoles, tagsById) {
  const targets = ["bottom", "utility"].filter((role) => !claimedRoles.has(role) && !result[role]);
  if (!targets.length) return false;
  let inferred = false;
  const available = candidates.filter((entry) => entry.role === null);
  if (targets.includes("bottom") && targets.includes("utility")) {
    let best = null;
    for (const adc of available) {
      const adcScore = botRoleScores(adc, tagsById).adc;
      if (adcScore < 45) continue;
      for (const support of available) {
        if (support.cellId === adc.cellId) continue;
        const supportScore = botRoleScores(support, tagsById).support;
        if (supportScore < 45) continue;
        const score = adcScore + supportScore + support.order / 1000 + adc.order / 10000;
        if (!best || score > best.score) best = { adc, support, score };
      }
    }
    if (best) {
      result.bottom = { id: best.adc.id, name: best.adc.name };
      result.utility = { id: best.support.id, name: best.support.name };
      return true;
    }
  }
  for (const [role, scoreKey] of [["bottom", "adc"], ["utility", "support"]]) {
    if (!targets.includes(role)) continue;
    const ranked = available.map((entry) => ({ entry, score: botRoleScores(entry, tagsById)[scoreKey] }))
      .filter(({ score }) => score >= 45)
      .sort((a, b) => b.score - a.score || (role === "utility" ? b.entry.order - a.entry.order : a.entry.order - b.entry.order));
    if (ranked.length) {
      result[role] = { id: ranked[0].entry.id, name: ranked[0].entry.name };
      inferred = true;
      available.splice(available.findIndex((entry) => entry.cellId === ranked[0].entry.cellId), 1);
    }
  }
  return inferred;
}
function teamByRole(session, key, names, tagsById, inferBotLane = false) {
  const result = { bottom: null, utility: null, jungle: null };
  const claimedRoles = new Set();
  const actions = (session.actions || []).flat();
  const pickOrder = new Map();
  actions.forEach((action, index) => {
    if (action?.type === "pick" && !pickOrder.has(action.actorCellId)) pickOrder.set(action.actorCellId, index);
  });
  const candidates = [];
  for (const [index, player] of (session[key] || []).entries()) {
    const role = assignedRole(player);
    const id = playerPick(session, player);
    if (role) {
      claimedRoles.add(role);
      if (role in result && id && names[id]) result[role] = { id, name: names[id] };
    }
    if (id && names[id]) candidates.push({
      cellId: player.cellId,
      id,
      name: names[id],
      role,
      order: pickOrder.get(player.cellId) ?? index,
    });
  }
  const estimated = inferBotLane ? inferEnemyBotLane(candidates, result, claimedRoles, tagsById) : false;
  return { ...result, estimated };
}
async function currentDraft() {
  const file = lockfilePath();
  if (!file) return { ok: true, phase: "ClientNotFound", draft: null, message: "League Client not found. Start League and enter Champion Select." };
  const { port, password } = parseLockfile(readFileSync(file, "utf8"));
  const phase = await localJson(port, password, "/lol-gameflow/v1/gameflow-phase");
  if (!["ChampSelect", "GameStart"].includes(phase)) {
    return { ok: true, phase, draft: null, message: phase === "None" ? "Waiting for Champion Select." : `League phase: ${phase}` };
  }
  const session = await localJson(port, password, "/lol-champ-select/v1/session");
  const catalog = await championCatalog();
  const names = catalog.names;
  const allies = teamByRole(session, "myTeam", names, catalog.tags);
  const enemies = teamByRole(session, "theirTeam", names, catalog.tags, true);
  return {
    ok: true,
    phase,
    draft: {
      allyAdc: allies.bottom,
      allySupport: allies.utility,
      allyJungle: allies.jungle,
      enemyAdc: enemies.bottom,
      enemySupport: enemies.utility,
      enemyBotLaneEstimated: enemies.estimated,
      blindPick: !enemies.utility,
      draftPhase: session.timer?.phase || null,
    },
    message: "Live League draft connected.",
  };
}

let lastResult = { ok: false, draft: null, message: "Waiting for the local service." };
let polling = false;
async function poll() {
  if (polling) return;
  polling = true;
  try { lastResult = await currentDraft(); }
  catch (error) { lastResult = { ok: false, phase: null, draft: null, message: error.message || "Could not read League Champion Select." }; }
  finally { polling = false; }
}
const server = http.createServer(async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Access-Control-Allow-Origin", "*");
  if (request.method === "OPTIONS") {
    response.writeHead(204, { "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" });
    response.end(); return;
  }
  if (request.method !== "GET" || !["/", "/health", "/draft"].includes(new URL(request.url, "http://127.0.0.1").pathname)) {
    response.writeHead(404); response.end("Not found"); return;
  }
  if (["/", "/health"].includes(new URL(request.url, "http://127.0.0.1").pathname)) {
    response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify({ ok: true, name: "CoachKtool" })); return;
  }
  await poll();
  response.writeHead(lastResult.ok ? 200 : 503, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(lastResult));
});
server.listen(PORT, HOST, () => console.log(`CoachKtool is listening on http://${HOST}:${PORT}. Keep this window open while drafting.`));
server.on("error", (error) => { console.error(`CoachKtool could not start: ${error.message}`); process.exitCode = 1; });



