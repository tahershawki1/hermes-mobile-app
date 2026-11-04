# UI revamp: conversational presence (phase 1)

**State:** First visual-conversation pass implemented on `feature/hermes-lively-presence-2026-11-04`. Review/CI and an actual Android WebView pass are pending. This is deliberately incremental, not a claim that the full redesign is complete.

**Next:** Run the web typecheck, unit tests, browser e2e (including `23-hermes-presence.cjs`) and the full PR CI. Confirm screen reader labels, reduced-motion mode, normal/light themes, long-chat scrolling, stream transitions and battery impact on a real phone. After this passes, iterate on voice expression and meaningful input gestures without timer-based animation.

**Needs a real phone:** Android 8+ and a modern phone; evaluate WebView performance, animation fluidity, battery, and no overlap with chat composer or tool cards.

**Links:** [UI inventory](../design/ui-inventory.md), [chat spec](../spec/03-02-chat-screen.md), [message spec](../spec/03-03-messages.md), [decision](../decisions/no-ui-test-work-before-revamp.md).

The conversational personality/profile skill is user-managed private configuration and is intentionally **not committed to this public repository**.
