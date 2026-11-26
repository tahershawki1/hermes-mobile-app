# This app is the only front end

**Superseded for channel UI:** The later decision [Messaging channels are in scope](messaging-channels-in-scope.md) records the owner's request to include Telegram, Discord, Slack and WhatsApp in Hermes Mobile. The status, header and generic settings rules below still apply except where the later decision says otherwise.

**Decided:** 2026-09-30, by the owner.

At the time of this decision, the owner did not use Telegram or another messaging channel. That was the reason to omit channel UI and the gateway log or "Always on" switch in Bots. The header dot ignores the dashboard's `overall` and uses dashboard, storage and disk only; generic Keys/Config hide messaging keys and groups (`MESSAGING_CATS`, `isMessagingField` in `web/src/components/Settings.tsx`). The bot keeper code in the plugin still exists and the supervisor does not start it (battery). The channel-UI prohibition is superseded by the decision linked above.

**So:** Keep messaging service health separate from the main app connection status, and keep generic key settings free of channel-managed credentials. Never switch a bot on while testing: profiles can share one bot token with other machines.
