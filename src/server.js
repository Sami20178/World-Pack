import http from "node:http";
import os from "node:os";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getCompatiblePackages } from "./package-catalog.js";

const execFileAsync = promisify(execFile);
const HOST = "127.0.0.1";
const PORT = Number(process.env.WORLD_PACK_PORT || 4317);
const INSTALL_TIMEOUT_MS = 10 * 60 * 1000;
const ALLOWED_ORIGIN = process.env.WORLD_PACK_UI_ORIGIN || "http://127.0.0.1:5173";

async function linuxDistribution() {
  try {
    const data = await fs.readFile("/etc/os-release", "utf8");
    const values = Object.fromEntries(data.split("\n").filter(Boolean).map(line => {
      const i = line.indexOf("=");
      return i < 0 ? [line, ""] : [line.slice(0, i), line.slice(i + 1).replace(/^["']|["']$/g, "")];
    }));
    return { id: values.ID || "linux", name: values.PRETTY_NAME || values.NAME || "Linux", version: values.VERSION_ID || null };
  } catch {
    return { id: "linux", name: "Linux", version: null };
  }
}

async function getPlatform() {
  const platform = process.platform;
  let distribution = null;
  if (platform === "linux") distribution = await linuxDistribution();
  return {
    platform,
    platformName: ({ win32: "Windows", linux: "Linux", darwin: "macOS" })[platform] || platform,
    release: os.release(),
    architecture: process.arch,
    distribution,
    adapters: {
      serviceInspection: ["win32", "linux"].includes(platform),
      packageInspection: ["win32", "linux"].includes(platform),
      installationEnabled: false,
      serviceChangesEnabled: false
    }
  };
}

async function listServices() {
  const platform = process.platform;
  let command, args;
  if (platform === "win32") {
    command = "sc.exe";
    args = ["query", "state=", "all"];
  } else if (platform === "linux") {
    command = "systemctl";
    args = ["list-units", "--type=service", "--all", "--no-pager", "--plain", "--no-legend"];
  } else {
    return { supported: false, readOnly: true, services: [], message: "Service inspection is not supported on this platform yet." };
  }

  try {
    const { stdout } = await execFileAsync(command, args, { timeout: 8000, maxBuffer: 1024 * 1024, windowsHide: true });
    const lines = stdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0, 100);
    return { supported: true, readOnly: true, services: lines, truncated: stdout.split(/\r?\n/).filter(Boolean).length > 100 };
  } catch (error) {
    const message = error.code === "ENOENT"
      ? "The system service inspection tool is not available."
      : "Service information could not be read. Try again or check the operating-system service manager.";
    return { supported: false, readOnly: true, services: [], message };
  }
}


async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 8192) throw new Error("Request body is too large.");
  }
  return JSON.parse(raw || "{}");
}

async function installPackages(selected) {
  if (process.platform === "linux") {
    const ids = selected.map(item => item.packageId);
    const { stdout, stderr } = await execFileAsync("pkexec", ["apt-get", "install", "-y", "--", ...ids],
      { timeout: INSTALL_TIMEOUT_MS, maxBuffer: 2 * 1024 * 1024, windowsHide: true });
    return { manager: "apt", output: [stdout, stderr].filter(Boolean).join("\n").slice(-12000) };
  }
  if (process.platform === "win32") {
    const outputs = [];
    for (const item of selected) {
      const { stdout, stderr } = await execFileAsync("winget",
        ["install", "--exact", "--id", item.packageId, "--accept-source-agreements", "--accept-package-agreements"],
        { timeout: INSTALL_TIMEOUT_MS, maxBuffer: 2 * 1024 * 1024, windowsHide: true });
      outputs.push(stdout, stderr);
    }
    return { manager: "winget", output: outputs.filter(Boolean).join("\n").slice(-12000) };
  }
  throw new Error("Installation is not supported on this operating system.");
}

function sendJson(res, status, data, origin) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...(origin === ALLOWED_ORIGIN ? {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Vary": "Origin"
    } : {})
  });
  res.end(JSON.stringify(data, null, 2));
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && origin !== ALLOWED_ORIGIN) {
    sendJson(res, 403, { error: "Origin not allowed." }, null);
    return;
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "600",
      "Vary": "Origin"
    });
    res.end();
    return;
  }

  const url = new URL(req.url || "/", "http://127.0.0.1");

  if (url.pathname === "/api/v1/install" && req.method === "POST") {
    if (origin !== ALLOWED_ORIGIN || req.headers["content-type"]?.split(";")[0] !== "application/json") {
      sendJson(res, 403, { error: "Installation requests must come from the configured World Pack UI." }, null);
      return;
    }
    let body;
    try { body = await readJson(req); }
    catch {
      sendJson(res, 400, { error: "Ungültige oder zu große JSON-Anfrage." }, origin);
      return;
    }
    if (body.confirmation !== "INSTALLIEREN" || !Array.isArray(body.ids) || !body.ids.length || body.ids.length > 10) {
      sendJson(res, 400, { error: "Wähle höchstens 10 Pakete und bestätige mit INSTALLIEREN." }, origin);
      return;
    }
    const platform = await getPlatform();
    const compatible = getCompatiblePackages(platform.platform, platform.distribution);
    const byId = new Map(compatible.map(item => [item.id, item]));
    const unknown = body.ids.filter(id => typeof id !== "string" || !byId.has(id));
    if (unknown.length) {
      sendJson(res, 400, { error: "Nicht unterstützte oder unbekannte Paket-IDs.", unknown }, origin);
      return;
    }
    const selected = [...new Set(body.ids)].map(id => byId.get(id));
    if (!selected.length || selected.some(item => item.manager !== selected[0].manager)) {
      sendJson(res, 400, { error: "Die Paketauswahl ist ungültig oder verwendet mehrere Paketmanager." }, origin);
      return;
    }
    try {
      const result = await installPackages(selected);
      sendJson(res, 200, {
        success: true,
        manager: result.manager,
        installedPackageIds: selected.map(item => item.id),
        output: result.output,
        message: "Der Paketmanager hat den Installationsvorgang beendet. Prüfe die angezeigte Ausgabe."
      }, origin);
    } catch (error) {
      const detail = error.code === "ENOENT"
        ? "Der erforderliche Paketmanager oder die Berechtigungsabfrage ist nicht verfügbar."
        : error.killed
          ? "Die Installation hat das Zeitlimit überschritten."
          : "Die Installation wurde abgebrochen oder ist fehlgeschlagen. Prüfe die Berechtigungsabfrage und den Paketmanager.";
      sendJson(res, 500, { success: false, error: detail }, origin);
    }
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Diese Route unterstützt diese HTTP-Methode nicht." }, origin);
    return;
  }

  if (url.pathname === "/api/v1/health") {
    sendJson(res, 200, { status: "ok", name: "World Pack Server", version: "0.2.0", mode: "confirmed-package-installation" }, origin);
    return;
  }
  if (url.pathname === "/api/v1/platform") {
    sendJson(res, 200, await getPlatform(), origin);
    return;
  }
  if (url.pathname === "/api/v1/services") {
    sendJson(res, 200, await listServices(), origin);
    return;
  }
  if (url.pathname === "/api/v1/packages") {
    const platform = await getPlatform();
    const packages = getCompatiblePackages(platform.platform, platform.distribution);
    sendJson(res, 200, {
      readOnly: true,
      installationEnabled: false,
      platform: platform.platform,
      distribution: platform.distribution?.id || null,
      packageManager: packages[0]?.manager || null,
      packages
    }, origin);
    return;
  }
  if (url.pathname === "/api/v1/install-plan") {
    const requested = (url.searchParams.get("ids") || "").split(",").map(value => value.trim()).filter(Boolean);
    if (!requested.length || requested.length > 20) {
      sendJson(res, 400, { error: "Bitte mindestens ein Paket und höchstens 20 Paket-IDs auswählen." }, origin);
      return;
    }
    const platform = await getPlatform();
    const compatible = getCompatiblePackages(platform.platform, platform.distribution);
    const byId = new Map(compatible.map(item => [item.id, item]));
    const unknown = requested.filter(id => !byId.has(id));
    if (unknown.length) {
      sendJson(res, 400, { error: "Nicht unterstützte oder unbekannte Paket-IDs.", unknown }, origin);
      return;
    }
    const selected = [...new Set(requested)].map(id => byId.get(id));
    const manager = selected[0].manager;
    if (selected.some(item => item.manager !== manager)) {
      sendJson(res, 400, { error: "Pakete mit unterschiedlichen Paketmanagern können nicht gemeinsam geplant werden." }, origin);
      return;
    }
    const commandPreview = manager === "apt"
      ? "sudo apt-get install -- " + selected.map(item => item.packageId).join(" ")
      : selected.map(item => "winget install --exact --id " + item.packageId).join(" && ");
    sendJson(res, 200, {
      readOnly: true,
      executable: false,
      installationEnabled: false,
      title: "Installationsvorschau",
      platform: platform.platform,
      distribution: platform.distribution?.id || null,
      packageManager: manager,
      packages: selected,
      steps: [
        "Paketquellen und Paket-IDs vor einer späteren Installation erneut prüfen.",
        "Benötigte Abhängigkeiten durch den nativen Paketmanager ermitteln lassen.",
        "Vor jeder Installation eine ausdrückliche Bestätigung einholen."
      ],
      commandPreview,
      notice: "Dies ist nur eine Vorschau. World Pack führt diesen Befehl nicht aus und verändert dein System nicht."
    }, origin);
    return;
  }
  sendJson(res, 404, { error: "Route not found." }, origin);
});

server.listen(PORT, HOST, () => {
  console.log(`World Pack Server listening at http://${HOST}:${PORT}`);
  console.log("Package installation requires explicit UI confirmation; service changes remain disabled.");
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
