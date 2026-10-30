# World Pack Server Architecture

## Purpose
The server is the privileged-operation boundary for World Pack. The desktop application requests an operation; the server validates it, explains it, obtains explicit approval, and delegates it to a platform adapter.

## Components
1. **Local API / IPC gateway** — binds to loopback or permission-protected local IPC; never exposes an unauthenticated admin API publicly.
2. **Identity and authorization** — per-install local identity, short-lived session credentials, and permission checks.
3. **Module registry** — signed or pinned metadata for optional modules, dependencies, supported platforms, and versions.
4. **Package catalog** — normalized package metadata (name, version, publisher, source, license, checksum/signature, platform).
5. **Installer orchestrator** — validates plans and asks the platform adapter to perform approved operations.
6. **Service manager** — reports service state and supports explicit start/stop/enable/disable requests.
7. **Update manager** — checks signed release metadata, stages updates, and supports rollback where the platform permits it.
8. **Audit log** — records requests, approvals, results, and errors without storing passwords or secrets.

## Platform adapters

### Windows
- Windows Service Control Manager adapter for service status and lifecycle.
- Installer adapters for trusted formats and package managers (for example, MSI/MSIX and configured package sources).
- EXE installers are external installers: publisher/signature and command-line behavior must be verified; no generic silent execution.

### Linux
- systemd adapter for service status and lifecycle.
- Distribution-specific package adapters (APT initially; other package managers later).
- Package installation requires user-authorized elevation through the operating system's normal privilege mechanism.

### Android / Google Play services
Google Play services are proprietary. World Pack must not bundle or redistribute them unless the relevant rights and distribution terms explicitly permit it. Integration is limited to a supported Android environment that already has licensed Google Mobile Services.

## API design (planned)
- GET /api/v1/health — service health and capability summary.
- GET /api/v1/platform — detected platform and supported adapter capabilities.
- GET /api/v1/modules — available module metadata.
- POST /api/v1/install-plans — validate a proposed install plan; does not execute it.
- POST /api/v1/install-plans/:id/approve — execute only after explicit local approval.
- GET /api/v1/services — list services World Pack is permitted to inspect.
- POST /api/v1/services/:id/actions — request a validated service action.

These routes are a design contract, not implemented endpoints yet.

## Security requirements
- Bind local control endpoints to loopback or OS-protected IPC.
- Use CSRF-resistant local authentication and unpredictable session tokens.
- Validate every path, package identifier, URL, and requested operation.
- Do not accept arbitrary shell commands from the UI or network.
- Do not store signing keys, OAuth secrets, or passwords in source control.
- Verify package provenance and integrity before installation.
- Use least privilege; request elevation only for the single approved action.
- Log security-relevant events while redacting credentials and personal data.

## Integration boundary
The existing All World server and frontend remain separate projects. World Pack should integrate through documented APIs or a pinned release artifact; it must not copy over or overwrite either repository.
