# Provider and model selection regression (2026-11-05)

## Reported
- Opening Model Providers repeatedly reloads the entire model catalog, taking too long.
- The model picker combines subscriptions/providers, allowing accidental cross-provider selections.
- Newly created bots cannot select their own default model, nor can the global default be set.
- A currently used Codex/OpenAI model is not displayed under the expected subscription; GitHub Copilot models appear instead.

## Required changes
1. Audit UI, RPC transport, model discovery, auth, profile creation/edit, and settings persistence.
2. Cache model lists by **provider and account** with TTL, request coalescing, immediate stale rendering, background revalidation, explicit refresh and error handling. Never cache secrets.
3. Require provider/account selection before showing models. Keep Codex/OpenAI OAuth distinct from GitHub Copilot. Show connection status and auth type; no implicit substitution.
4. Implement and verify model defaults: chat override > bot/profile default > global default, unless backend precedence differs, in which case document and preserve intended semantics.
5. Ensure both create/edit bot and global settings can select, save, restore and validate the default model; preserve existing settings and gracefully flag disconnected providers.
6. Diagnose Codex OAuth discovery from real authenticated state, not from model names; never claim an account is connected without credential verification.
7. Add regression coverage for repeated open, provider isolation, account switching, expired auth, empty catalog, bot creation, global default, restart persistence and invalid model references.
8. Implement on this branch, run checks, then merge to main for existing automatic APK build/sign/publish. Do not modify publication workflow unnecessarily.

Status: investigation pending; no functional fix claimed.
