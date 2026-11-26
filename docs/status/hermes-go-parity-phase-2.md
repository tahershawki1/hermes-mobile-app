# Hermes Go parity — Phase 2

Phase 1 is accepted. Its two follow-up fixes are implemented and covered by the `15-gestures.cjs` browser check. The wide-screen interface polish has a separate local preview and draft PR. At the user's direction, feature transfer has resumed. Multi-server support and Hermes Cloud are canceled and excluded from this plan.

Phase 2 follows the order of the Go-only feature inventory in `comparison-full-ar.md`. Each item stays in progress until the feature has an implementation, a practical check against a running Hermes endpoint (or a documented reason a real endpoint is required), a local APK preview, and user review. After each check, update this order if evidence changes the priority or reveals a dependency.

| Order | Feature group | Practical acceptance check | State |
|---:|---|---|---|
| 1 | Messaging channel status and configuration, including WhatsApp QR phone linking. | Use a test Telegram/Discord channel, then scan WhatsApp QR from a disposable phone; verify linked number, status, restart and reconnect without exposing secrets. | Implemented; mock E2E passed; live device check pending |
| 2 | Webhook routes and lifecycle. | Create a test route, deliver a sample event, disable and delete it. | Paused |
| 3 | Gateway pairing and QR provisioning. | Pair a disposable test account/device and verify accept/reject paths. | Paused |
| 4 | Remote host health/status dashboard. | Compare app status to the selected test host and verify offline/error states. | Paused |
| 5 | Host resource metrics (CPU, memory, disk, sessions/tokens). | Compare displayed values with the host's own measurements and exercise warning thresholds. | Paused |
| 6 | Logs, operations and system settings. | Run safe read-only checks first; destructive or secret-changing operations require explicit review. | Paused |
| 7 | Interactive terminal and SSH connections. | Connect to a disposable test host, run harmless commands, reconnect, and close sessions. | Paused |
| 8 | Processes, background jobs, subagents and Kanban. | Start, observe, stop and hide a disposable process/task; verify live updates. | Paused |
| 9 | Server channel/configuration settings and credentials. | Change a reversible test setting and verify it survives reconnect. | Paused |
| 10 | Credential Vault integrations. | Verify masked secrets, add/remove a disposable credential, and test external vault handoff. | Paused |
| 11 | Bot groups and shared rooms. | Create a disposable group, exchange messages/files and verify member permissions. | Paused |
| 12 | Team consensus and summaries. | Run a small test discussion and compare transcript and summary outputs. | Paused |
| 13 | Build Team workflows. | Draft, verify and execute a test team setup, then archive it. | Paused |
| 14 | Bot routines and team schedules. | Schedule a one-time harmless routine, run it, inspect its result and cancel it. | Paused |
| 15 | Capsules. | Create a test capsule, refresh data, edit/restore it and verify its alert behavior. | Paused |
| 16 | Linux desktop view/control. | Use a disposable desktop session; verify takeover pause/resume and permission boundaries. | Paused |
| 17 | Cost Guard and provider quotas. | Use mock or low-cost limits; verify preflight blocks and confirmation thresholds. | Paused |
| 18 | Star Map, MCP and plugin catalog/update health. | Install/update a harmless test plugin, inspect health and approve/reject an update. | Paused |
| 19 | Extended project/session tools and loops/heartbeat controls. | Test repository scanning, bulk session actions, loop pause/resume and heartbeat controls. | Paused |

**Dependency before item 1 practical acceptance:** a reachable Hermes host other than the phone's local `127.0.0.1:9119`, preferably a disposable test instance. Development can use the local dashboard and a mock server, but that does not prove LAN/Tailscale/HTTPS connectivity or real-host compatibility.
