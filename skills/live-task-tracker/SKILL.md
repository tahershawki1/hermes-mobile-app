---
name: live-task-tracker
description: Track multi-step Hermes tasks with verified status, concise progress summaries, and UI-ready state events.
---

# Live Task Tracker

When a request requires multiple actions, create a task list before execution. Keep it synchronized with real execution, not with guesses.

## Status vocabulary

- `pending`: queued, neutral gray ○
- `running`: currently executing, glowing yellow 🟡
- `succeeded`: finished and verified, green ✅
- `failed`: attempted and failed, red ❌
- `blocked`: cannot continue without input or permission, amber ⏸
- `cancelled`: user stopped execution, gray ⊘

Never mark a task succeeded just because a command was issued. Require evidence such as exit code, file existence, test output, API confirmation or user-visible result. Never fabricate activity.

## Execution procedure

1. Break the user request into small, observable tasks with IDs, titles and a completion criterion.
2. Display the initial checklist, with the first active task marked running.
3. Before each action, publish `task.started` with its ID.
4. After an action, verify the outcome. Publish `task.succeeded` only on confirmation; otherwise publish `task.failed` with a short reason.
5. Move to the next actionable task. If failure blocks dependencies, mark those tasks blocked, not succeeded.
6. On every transition, update a brief Arabic summary: `تم` (completed), `جاري` (current), `التالي` (next). Never expose private chain-of-thought; summarize only observable steps, tools and outcomes.
7. Preserve task state per conversation and resume correctly after interruptions. On restart, reconcile with durable action history before changing statuses.
8. Finish with counts and any unresolved errors.

## Event contract

Emit a structured progress event through the host application's supported event transport if available:

```json
{
  "type": "task.status",
  "conversation_id": "<conversation id>",
  "task_id": "task-1",
  "title": "Run build",
  "status": "running",
  "summary": "جاري تشغيل البناء",
  "updated_at": "<ISO-8601 timestamp>"
}
```

The frontend should deduplicate by `conversation_id + task_id`, order updates by a monotonic sequence if provided, and persist last known state. Do not claim the event transport exists until implemented and tested.

## Face animation mapping

- `thinking`: gentle eye movement, purple ambient glow. Means planning/processing, not literal access to model thoughts.
- `running`: yellow pulse and scanning eye movement.
- `succeeded`: short green smile/check animation.
- `failed`: short red concerned expression, then idle.
- `idle`: soft neutral breathing animation.
- `blocked`: amber pause animation.

Respect Android reduced-motion settings, battery saver, screen-reader labels, and avoid continuous high-frequency rendering in background. Never infer success/failure from the assistant's tone; derive it from task events.

## User-facing format

```text
المهام
✅ تحليل الطلب
🟡 تعديل الواجهة (جاري)
○ اختبار البناء
○ مراجعة النتيجة

تم: ...
جاري: ...
التالي: ...
```

For a failed task, show `❌` and the failure reason. If no execution telemetry is available, say that status is unverified rather than inventing progress.
