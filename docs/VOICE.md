# Voice input/output and desktop notifications

These are frontend-only, browser-native capabilities layered onto the AI
Agent chat -- no server-side audio pipeline, no API key, nothing to install.
They degrade honestly when the browser doesn't support them (spec principle:
never pretend a capability works when it doesn't).

## Voice input (speech-to-text)

`frontend/src/hooks/useSpeech.ts` wraps the browser's native
`SpeechRecognition` API (`window.SpeechRecognition` /
`window.webkitSpeechRecognition`). On the AI Agent page, the microphone
button next to the text box starts/stops listening; the live transcript
fills the message box as you speak, so you can review or edit it before
sending exactly like typed text.

**Support**: Chrome and Edge support `SpeechRecognition` today; Firefox and
Safari currently do not. When unsupported, the mic button is disabled with a
tooltip explaining why, and the rest of the app (typing) works normally --
voice is additive, never required.

## Voice output (text-to-speech)

The same hook wraps `window.speechSynthesis` (`SpeechSynthesisUtterance`),
supported in effectively all modern browsers. Checking "Speak responses" on
the AI Agent page speaks the agent's final response aloud as each request
completes; "Stop speaking" cancels playback immediately (the spec's
interruption requirement -- "AI: I've started opening... USER: Stop." --
is handled the same way an agent run itself is cancelled: the browser's
`speechSynthesis.cancel()` stops audio immediately, and a running agent
request is a separate concern already handled by the backend's own
iteration/timeout limits).

## Desktop notifications

`frontend/src/hooks/useDesktopNotifications.ts` polls
`GET /api/notifications?unread_only=true` every 15s and fires a real
browser `Notification` (the Notification Web API -- an actual OS-level
desktop notification, not an in-app toast) for anything new. Permission is
only requested the first time there's something to show, never on page
load. If the browser denies or doesn't support it, the in-app unread badge
in the sidebar still works -- notifications are never silently lost, just
not also pushed to the desktop.

Backend events that create a `Notification` row (see
`app/services/notification_service.py` and its callers in
`app/agent/orchestrator.py` / `app/services/workflow_service.py`):

| Event | Level |
|---|---|
| Agent run enters `WAITING_FOR_APPROVAL` | `action_required` |
| Agent run completes *and performed at least one tool call* | `info` |
| Agent run fails | `warning` |
| Workflow run completes | `info` |
| Workflow run fails | `warning` |

A plain Q&A exchange with no tool calls does not notify -- see spec
principle on not overusing notifications for routine chat.

## What this is not

This is **not** the master spec's full OS-level voice pipeline (wake word,
always-on background listening, local STT/TTS models via a desktop agent
process). It's real, working voice I/O for the web app that ships with this
project today, built on standard browser APIs that require no extra
installation. A future desktop agent (see `docs/ROADMAP.md`) could add a
local STT/TTS provider behind the same `useSpeech`-shaped interface without
changing the rest of the UI.
