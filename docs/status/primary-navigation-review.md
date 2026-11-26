# Hermes Mobile primary navigation

**State:** Navigation behavior from phase 1 is accepted. The visual redesign is now in progress on `codex/hermes-chat-review`: shared gold theme tokens replace the previous blue navigation tint, the global button focus ring follows the theme accent, the main bar follows the preview order (Home, Work, Knowledge, Sessions, More), and full-screen pages share a centered 760 px content frame. Home, Sessions, Work, Knowledge and More remain in place, the chat stays mounted across navigation, and local Hermes uses the existing Termux integration. The drawing workspace and its dedicated attachments and dependencies are removed; general attachment protections and cleanup are retained. The review pass has not yet been checked on a phone.

**Next:** Continue the shared-screen redesign, then review the local preview APK on a phone and, if available, a tablet. Start or resume a chat, then check Home → Continue chat, Work, Knowledge, More, the drawer gestures, light/dark themes, and the large-screen Canvas controls. Keep Hermes Go feature work paused until this UI review is complete.

**Needs a real phone:** Start or resume a chat, type a draft, visit Knowledge and Work, and return through Home → Continue chat. Open the Add and Commands menus and check that ordinary photos and files can be attached. Verify Home → Status details, More → System, notification deep links and Back from a subpage. Try the dark and light themes and an Arabic system locale. Check that voice, Canvas, the drawer and approvals still work.

**Links:** [Navigation specification](../spec/03-01-navigation-map.md), [Android review workflow](../spec/07-04-workflows.md).
