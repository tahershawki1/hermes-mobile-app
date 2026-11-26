# Wide screens and tablets

**State:** Wide screens can hide the docked chat list (`web/src/sidepanel.ts`, `hm.sideHidden.v1`), and docked pages sit
above the list so their sheets cover it. From 700 px the canvas is a column beside the chat with a draggable divider
(snaps to full screen / closed, remembered as a share in `hm.canvasSplit.v1`), a pull tab and swipe at the right edge
bring it in, and the shell keeps Android's Back gesture off that strip (`setEdgeGrab`, API 29+). Browser checks pass
(`tools/web-e2e/checks/16-canvas-panel.cjs`). The latest local UI pass improves the wide-screen panel toggle, divider
grip and Canvas pull tab. Not yet seen on a real tablet or a large emulator.

**Next:** review the updated controls in the local preview on a tablet or large-screen emulator with gesture navigation:
check that the edge pull opens Canvas and Android Back still works elsewhere on the edge. This is still a visual review
item; there is no claim of tablet-device verification yet.

**Needs a real phone:** a tablet (or a large-screen emulator).

**Links:** `web/src/sidepanel.ts`, `web/src/splitview.ts`, `docs/spec/03-13-drawer-session-list.md`,
`docs/spec/03-07-canvas-panel.md`.
