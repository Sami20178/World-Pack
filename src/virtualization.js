import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PROFILES = [
  {
    id: "android-9-api-28",
    name: "Android 9",
    androidApi: 28,
    status: "test-profile",
    notes: "Compatibility baseline for the Android bridge."
  },
  {
    id: "kindle-fire-fire-os-7",
    name: "Kindle Fire / Fire OS 7",
    androidApi: 28,
    status: "test-profile",
    notes: "Fire OS 7 is Android 9-based; exact model and Fire OS build must be verified."
  }
];

async function detectQemu(binary) {
  try {
    const { stdout, stderr } = await execFileAsync(binary, ["--version"], {
      timeout: 4000,
      maxBuffer: 16 * 1024,
      windowsHide: true
    });
    const firstLine = (stdout || stderr).split(/\r?\n/)[0]?.trim() || "Version unavailable";
    return { available: true, binary, version: firstLine };
  } catch (error) {
    return {
      available: false,
      binary,
      reason: error.code === "ENOENT" ? "not-installed-or-not-on-PATH" : "check-failed"
    };
  }
}

export async function getVirtualizationStatus() {
  const suffix = process.platform === "win32" ? ".exe" : "";
  const [arm64, x86_64] = await Promise.all([
    detectQemu("qemu-system-aarch64" + suffix),
    detectQemu("qemu-system-x86_64" + suffix)
  ]);
  return {
    readOnly: true,
    host: { platform: process.platform, architecture: process.arch },
    qemu: { available: arm64.available || x86_64.available, targets: [arm64, x86_64] },
    profiles: PROFILES,
    executionEnabled: false,
    firmwareFlashingEnabled: false,
    message: "This endpoint only checks host QEMU availability and lists compatibility profiles. It does not start a VM or modify a device."
  };
}
