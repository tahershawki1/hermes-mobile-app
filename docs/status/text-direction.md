# Arabic and English text direction

Implemented automatic paragraph direction, a persistent Appearance picker, logical list/quote spacing,
and isolated links/code. Existing message content is never rewritten.

Verified: production web build, TypeScript, four direction unit cases, spec and changelog checks,
and 20 browser assertions with a mock gateway at 375×812 and 1100×850. Browser checks include measured
word order, per-line user content, Markdown paragraphs, lists, cells, links/code, editing and saved settings.
All 438 unit tests pass with Node webstorage disabled and a 30-second hook timeout on Windows. No real-phone verification yet.
