# Model provider isolation

**State** (2026-11-05): implemented and extended by `fix/shared-subscription-logins`. Model catalogs are cached per bot for 30 minutes, model pickers expose one provider at a time, subscription accounts have their own section, credential-pool OAuth entries repair missing Codex status, named bots display OAuth subscriptions inherited from the Main profile, and a new bot opens its model picker immediately. Web unit tests and type checking pass.

**Next:** let GitHub CI run the browser checks (the current runner has no usable Playwright browser), review the picker on a narrow phone viewport, then merge after CI.

**Needs a real phone:** confirm a real ChatGPT/Codex login appears as `Main profile · …` and Shared inside a named bot, Copilot remains separate, reopening the picker is immediate, and a newly created bot can select its default model.

**Links:** user report, 2026-11-05.
