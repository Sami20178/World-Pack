import http from "node:http";
import os from "node:os";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getCompatiblePackages } from "./package-catalog.js";

const execFileAsync = promisify(execFile);
const HOST = "127.0.0.1";
const PORT = Number(process.env.WORLD_PACK_PORT || 4317);
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
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "600",
      "Vary": "Origin"
    });
    res.end();
    return;
  }

  const url = new URL(req.url || "/", "http://127.0.0.1");
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Only GET requests are available in this prototype." }, origin);
    return;
  }

  if (url.pathname === "/api/v1/health") {
    sendJson(res, 200, { status: "ok", name: "World Pack Server", version: "0.1.0", mode: "read-only-prototype" }, origin);
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
      : "winget install --exact " + selected.map(item => "--id " + item.packageId).join(" ");
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
  console.log("Read-only mode: installations and service changes are disabled.");
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
