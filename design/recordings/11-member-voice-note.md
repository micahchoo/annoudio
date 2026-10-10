# 11-member-voice-note

**Member (phone)** · Record a voice note; Processing, then Waiting for review on Your stories

The member (signed in from video 10) opens the Annotate page at 0:06, writes a line, selects **Record a voice note**, then **Stop the voice note** and **Attach this voice note** (Chromium's fake microphone gives a beep). Right after Attach the form says "Processing. You can send the story now." **Send for review**: this Annotate page has no return address, so the done screen "Your story is sent" shows the state, already **Waiting for review** (the worker took about 2 s). **Your stories** lists it under Waiting for review. (When the worker is slower, the script waits on Your stories with the Processing card, fast-forwarded 4×.)

[11-member-voice-note.webm](11-member-voice-note.webm) · 28.8 s · 0.43 MB · 390×844 viewport · recorded 2026-10-09.

Stumbles seen while recording:

- The voice note is processed from the moment of Attach ("Processing. You can send the story now.") and is ready in about 2 s, so after Send for review the story is at once Waiting for review: the member never sees the state Processing on the done screen or on Your stories.
- Cards on Your stories carry no date or time: three stories on the same range (0:06–0:10) with the same text look identical, and the member cannot tell which one is new.
