### Text direction in messages, the composer and Appearance

`text-direction.ts` in `web/src/` stores the reader's `TextDirection` preference in `hm.textDirection.v1`.
`validDirection` accepts `auto`, `rtl` and `ltr`, defaulting to `auto` for missing or invalid values.
`useTextDirection` subscribes the composer, message editor, plain text and Markdown to live changes;
`setTextDirection` updates the preference and saves it locally, including when Hermes is offline.

Settings → Appearance has a Text direction section with the picker `اتجاه النص / Text direction`.
Its options are `تلقائي / Automatic`, `من اليمين إلى اليسار / Right to left` and
`من اليسار إلى اليمين / Left to right`. This preference applies to existing and new content.
Automatic uses the browser's first strong character for each plain-text line and Markdown paragraph,
heading, list item, quote and table cell. Arabic aligns right and English aligns left.
Mixed paragraphs follow their base direction; choose a fixed direction when their initial word gives
the wrong reading direction. Links are isolated from surrounding text and detect their own direction.

`rehypeTextDirection` runs after sanitization, so supplied HTML cannot override the reader's preference.
`web/src/text-direction.css` gives lists and quote borders logical spacing. Code blocks, inline code
and formulas keep left-to-right display. Application navigation and control order do not change.
`Linked` uses `.plain-text` and `.plain-line` to give each line its own direction while preserving the
original text and newlines for copying and quoting. Message editing follows the same preference.

`web/src/text-direction.test.ts` checks preference validation and unchanged mixed-language content.
`tools/web-e2e/checks/25-text-direction.cjs` checks rendered direction, visual word order, settings
persistence, input, editing, Markdown, links and code with a mock gateway.
