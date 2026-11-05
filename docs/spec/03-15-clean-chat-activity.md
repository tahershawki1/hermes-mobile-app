# Clean chat activity

The chat timeline keeps the primary conversation readable: user messages, Hermes replies, and attached files remain in the timeline. Tool calls and streamed terminal output are represented by one-line clickable placeholders and are not rendered as command text in the conversation.

Clicking a placeholder opens the `ToolDetailsPanel`, a separate edge panel containing the full tool arguments, summaries, results, diffs, media, and terminal transcript. Closing the panel returns to the same chat position. The panel also handles Android Back.

`ToolCard` supports compact placeholders in the chat and expanded details in the activity panel. `ToolRunHead` represents a consecutive tool run as one placeholder. The chat no longer renders `TerminalTranscript` inline.
