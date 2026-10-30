# World Pack Core service architecture

## Purpose

The World Pack server is the control plane for a modular device platform. The current Node.js process is a local development service, not a privileged Android system service.

## Responsibilities

- Report service health and detected platform capabilities.
- Validate a versioned extension manifest.
- Expose module status and compatibility metadata.
- Keep package installation allowlisted and explicitly confirmed.
- Record test outcomes without collecting personal device identifiers.

## Service levels

- **Node.js control plane:** local API on loopback; existing implementation.
- **Android companion bridge:** ordinary Android application process; may use a user-visible foreground service in a future implementation, subject to Android background-execution rules.
- **Privileged OS service:** not available to a normal APK. Requires platform/vendor integration, appropriate signing, and device support.
- **Virtual test service:** runs only inside a disposable emulator/VM.

## Extension contract

Every extension must have a stable ID, version, supported platforms, declared permissions, and a verified entry point. Unknown permissions and arbitrary command strings are rejected. Remote manifest content is metadata only and must never be evaluated as code.

## Custom firmware lab

Firmware build/boot experiments are isolated from the production service. Only authorized, compatible images may be used. The lab must not expose physical-device flashing, bootloader unlocking, verified-boot bypass, or destructive storage operations.

## Current status

This file defines the target architecture. The current API does not yet provide a complete module runtime, privileged service manager, VM orchestrator, or CFW image builder.
