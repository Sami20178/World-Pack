# World Pack — Server & System Services

World Pack is the service and installation backend for a cross-platform desktop environment.

## Repository responsibility
This repository contains the Node.js control plane, update metadata, service orchestration APIs, platform adapters, and installer integration. The desktop UI and product documentation live in [World-Pack-Source-Code](https://github.com/Sami20178/World-Pack-Source-Code).

## Planned platform support
- **Windows 10/11:** Windows Service integration and supported installer/package-manager adapters.
- **Linux:** systemd service integration and distribution-aware package adapters (initially Debian/Ubuntu).
- **Android integrations:** optional connection to a properly licensed Android environment. Google Play services are not redistributed by World Pack.

## Safety model
- Never silently elevate privileges or run installers as administrator/root.
- Show package, publisher, source, permissions, and actions before installation.
- Require explicit confirmation for install, update, removal, and service changes.
- Verify signatures/checksums where upstream packages provide them.
- Do not execute arbitrary downloaded EXE, shell, or package scripts.
- Keep platform-specific operations behind adapters.

## Initial architecture
See [docs/SERVER-ARCHITECTURE.md](docs/SERVER-ARCHITECTURE.md). The server is planned as a local-first control plane with authenticated IPC/API access, a module registry, package catalog, update checks, and platform adapters.

## Development status
**Foundation / planning stage.** This repository is being prepared on the world-pack-foundation branch. No operating-system services or installers are installed by this documentation commit.
