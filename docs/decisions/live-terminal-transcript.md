# Live terminal transcript

**Decided:** 2026-11-04, by the owner.

Separate terminal cards take too much room on a phone, and users need to see command output as it arrives.

**So:** Group consecutive terminal calls in one compact transcript. Stream redacted output chunks from local foreground commands, associate each chunk with its tool call, and keep non-terminal tools separate. Remote terminal backends and identical concurrent commands retain their final output without live streaming.
