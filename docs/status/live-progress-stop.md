# Live activity and stop acknowledgement

**State:** Implemented (2026-11-11).

**Scope:** Make grouped tool work describe the latest observed operation and show Hermes-provided completion summaries. A Stop tap is acknowledged in the interface immediately, while the running turn remains locked until cancellation is confirmed.

**Verification:** Targeted fold/gateway tests (21 passed), TypeScript, production build, spec/changelog validation, and browser checks 07–08 passed. In the broader browser suite, check 14 passed on isolated rerun; check 16 still fails on the empty-new-chat canvas swipe, outside this work. Real-phone visual and cancellation timing check still required.

**Next:** Review CI, then validate narrow-screen clipping and actual engine stop latency on the owner's phone.
