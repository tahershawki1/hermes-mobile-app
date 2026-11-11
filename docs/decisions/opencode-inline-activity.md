# OpenCode-style inline activity

**Decided:** 2026-11-11, by the owner.

The chat should show the model's real-time progress in the conversation without the existing tool cards. The owner wants
the compact, event-led presentation used by OpenCode.

**So:** Render observed tool and sub-agent work as plain, compact transcript lines; tapping a line opens its details in
the Activity panel. Show provider-emitted reasoning summaries as they arrive, and show an honest thinking indicator
before the first such event. Preserve streamed answer text and meaningful Hermes status updates. Do not invent model
thoughts or imply that private reasoning is available when the provider sends none. Keep errors and user-requested
interactive OpenUI cards unchanged.
