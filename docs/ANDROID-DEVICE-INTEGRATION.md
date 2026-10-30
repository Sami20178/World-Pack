# Android device integration: SIM and SD card

## Goal

World Pack is planned to grow beyond its current Windows/Linux desktop prototype. Android support must be delivered as a separate, native Android companion/bridge. The existing Vite interface and Node.js desktop server cannot independently access Android telephony or removable-storage APIs.

## SIM capability module

The native Android bridge may report only capability and status data that the operating system permits:

- whether telephony hardware/features are present;
- SIM state (for example, ready, absent, locked, or unknown);
- whether mobile-network service is available, when the platform exposes it;
- a user-facing explanation when a permission or platform restriction prevents a result.

Privacy and safety boundaries:

- Do not collect, display, or transmit phone numbers, IMSI, ICCID, IMEI, contacts, SMS, call history, or other subscriber identifiers.
- Request only the minimum permission needed for a clearly explained status feature. On Android versions where SIM status requires a runtime permission, ask in the native app and explain why.
- Never silently request permissions or upload telephony information.
- No SIM unlocking, carrier-lock bypass, eSIM provisioning, or network restriction bypass.

A device without cellular modem/SIM hardware must be reported as unsupported; software cannot add that hardware.

## SD-card and removable-storage module

The native bridge may report:

- whether removable/shared storage is available;
- a user-visible storage label when provided by Android;
- total and available capacity where the platform exposes it;
- access state (available, not mounted, permission required, or unknown).

File access must use Android's Storage Access Framework (SAF) or another documented, platform-approved API. The user chooses the storage location and grants access. Do not scan private app data or silently move, delete, or rewrite files.

Do not claim that arbitrary apps can be moved to an SD card. App-install location and adoptable-storage support depend on the device manufacturer, Android release, and app.

## Compatibility notes

- The first target is Android 9 / API 28 and newer, with Fire OS variants treated as vendor-specific.
- Amazon Fire tablets without cellular hardware will correctly report SIM support as unavailable.
- Android 10+ storage restrictions differ from Android 9; implement and test per API level rather than assuming one storage path.
- The current Node.js server is not an Android system service. Android capability data must come from a separately installed native bridge and be passed through a narrow, validated local interface.

## Implementation sequence

1. Define shared capability response contracts.
2. Build a native Android bridge for read-only SIM and storage status.
3. Add explicit user-granted SAF folder access.
4. Add device/API-level compatibility checks and tests.
5. Connect the bridge to the World Pack UI only after native permission and privacy flows are tested.

## Current status

This document is an architecture/specification starting point. No SIM access, SD-card access, Android system modification, or OS switching has been implemented by this commit.
