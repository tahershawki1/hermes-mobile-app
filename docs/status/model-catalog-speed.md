# Model catalog speed

**State** (2026-11-11): The model picker now restores its last catalog from versioned device storage, including the live-refresh timestamp, so a previously loaded list is available immediately after restarting the app. In-memory behavior remains the fallback if storage is unavailable.

**Next:** Run web checks and CI; verify first-load and restart behavior on a real phone.

**Needs a real phone:** Confirm model names appear immediately on reopening the app, then verify a provider/sign-in change refreshes the catalog.

**Links:** `fix/persist-model-catalog`.
