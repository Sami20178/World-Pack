# World Pack — Core Service & Control Plane

World Pack is a modular device platform. This repository contains its Node.js control plane and platform adapters; the dashboard and Android bridge prototype live in [World-Pack-Source-Code](https://github.com/Sami20178/World-Pack-Source-Code).

## Core architecture

- **Core service:** reports health, platform capabilities, and approved module metadata.
- **Extensions:** declared by a versioned manifest; untrusted remote metadata is never executed as code.
- **Android bridge:** an ordinary app-scoped companion prototype, not a privileged Android system daemon.
- **Android VM Lab:** planned disposable emulator test environment.
- **Custom Firmware Lab:** planned virtual-only boot testing of authorized compatible images; no physical-device flashing.

See [System service architecture](docs/WORLD-PACK-SYSTEM-ARCHITECTURE.md) and [VM / CFW test plan](docs/VM-CFW-TEST-PLAN.md).

## Current implementation: Phase 3 package installation

The backend provides a curated package catalog and validated install previews for Windows (winget) and Debian/Ubuntu (APT). Installation is available only through the dedicated endpoint and only for package IDs in the catalog. The UI asks for two confirmations; Linux uses pkexec for OS authorization. The server never accepts arbitrary shell commands.

## Requirements

- Node.js 20 or newer
- Windows 10/11 with winget, or Debian/Ubuntu with APT and pkexec

## Run locally

```sh
npm install
npm run check
npm test
npm start
```

The API listens only on `http://127.0.0.1:4317`.

## API

- `GET /api/v1/storage` — read-only storage capacity for accessible volumes.
- `GET /api/v1/virtualization` — read-only QEMU host detection and Android 9 / Kindle Fire OS 7 compatibility profiles.
- `GET /api/v1/health` — server health and mode.
- `GET /api/v1/platform` — OS, release, architecture, distribution, and adapter capabilities.
- `GET /api/v1/services` — read-only service list.
- `GET /api/v1/packages` — curated packages supported by the detected platform.
- `GET /api/v1/install-plan?ids=git,curl` — validates IDs and returns an install preview.
- `POST /api/v1/install` — installs allowlisted packages only after exact confirmation and origin checks.

## Security boundaries

- Server binds to loopback.
- Package IDs come only from the curated catalog.
- Installation uses fixed executable names and argument arrays; arbitrary commands are never accepted.
- No silent elevation, arbitrary scripts, service mutation, or firmware flashing is implemented.
- Android storage access does not bypass scoped-storage restrictions.
- No bootloader unlocking or verified-boot bypass is provided.

## Status

The current backend is not a privileged OS service and does not yet implement a module runtime, VM orchestrator, firmware image builder, or CFW test runner. The QEMU endpoint only detects installed QEMU executables; it does not launch virtual machines. The VM/CFW lab is currently a documented plan only.