# World Pack — Server & System Services

World Pack is the service and installation backend for a cross-platform desktop environment.

## Phase 3: confirmed package installation
The backend provides a curated package catalog and validated install previews for Windows (winget) and Debian/Ubuntu (APT). Installation is available only through the dedicated endpoint and only for package IDs in the catalog. The UI asks for two confirmations before sending the request; Linux uses pkexec for the operating-system authorization prompt. The server never accepts arbitrary shell commands.

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
- `GET /api/v1/health` — server health and mode.
- `GET /api/v1/platform` — operating system, release, architecture, detected Linux distribution, and supported adapter capabilities.
- `GET /api/v1/services` — read-only service list.
- `GET /api/v1/packages` — curated packages supported by the detected platform and whether the installation adapter is enabled.
- `GET /api/v1/install-plan?ids=git,curl` — validates selected IDs and returns an install preview.
- `POST /api/v1/install` — installs up to 10 allowlisted packages only after the UI sends the exact confirmation value and the configured origin.

## Security boundaries
- The server binds only to loopback; browser installation requests require the configured UI origin and JSON content type.
- Capability flags in the platform and package endpoints are derived from the same detected compatible-package catalog.
- Installation uses `execFile` with fixed executable names and argument arrays; arbitrary commands are never accepted.
- Package IDs come exclusively from the curated catalog.
- Linux elevation is delegated to `pkexec`; Windows uses the native winget process and its own prompts.
- Service start/stop, package removal, arbitrary scripts, and silent elevation are not implemented.
- Review package names and IDs before confirming. Package installation changes the operating system.

## Repository responsibility
This repository contains the Node.js control plane and OS-specific adapters. The desktop UI lives in [World-Pack-Source-Code](https://github.com/Sami20178/World-Pack-Source-Code).

Google Play services are not redistributed by World Pack; any Android bridge must use a properly licensed environment.
