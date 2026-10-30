# World Pack — Server & System Services

World Pack is the service and installation backend for a cross-platform desktop environment.

## Phase 2 prototype
The backend now provides a curated package catalog and a read-only installation-plan preview for Windows (winget) and Debian/Ubuntu (APT). The preview validates package IDs and shows the native package-manager command, but never executes it. No packages are installed and no services are changed.

## Requirements
- Node.js 20 or newer
- Windows 10/11 or Linux (Ubuntu/Debian are the initial Linux targets)

## Run locally
```sh
npm install
npm run check
npm test
npm start
```
The API listens only on `http://127.0.0.1:4317`.

## API
- `GET /api/v1/health` — server health and prototype mode.
- `GET /api/v1/platform` — operating system, release, architecture, and detected Linux distribution.
- `GET /api/v1/services` — read-only service list (Windows Service Control Manager query or Linux systemd query).
- `GET /api/v1/packages` — curated packages supported by the detected platform.
- `GET /api/v1/install-plan?ids=git,curl` — validates selected IDs and returns a non-executable install preview.

Only GET and OPTIONS are accepted. The API binds to loopback, limits browser access to the configured UI origin, and returns no-store responses.

## Repository responsibility
This repository contains the Node.js control plane, platform adapters, and installer integration. The desktop UI lives in [World-Pack-Source-Code](https://github.com/Sami20178/World-Pack-Source-Code).

## Planned platform support
- **Windows 10/11:** Windows Service integration and supported installer/package-manager adapters.
- **Linux:** systemd service integration and distribution-aware package adapters (initially Debian/Ubuntu).
- **Android integrations:** optional connection to a properly licensed Android environment. Google Play services are not redistributed by World Pack.

## Safety model
- No silent elevation or arbitrary shell commands.
- No installation, removal, or service changes in Phase 1.
- Explicit approval and operating-system privilege prompts are required for future write operations.
- Verify package provenance and integrity before future installation.

## Development status
**Phase 2 — package catalog and preview.** Actual installation, removal, updates, service changes, and desktop packaging are not implemented.
