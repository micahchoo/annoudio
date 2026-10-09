// The player's private CSS. It reads tokens only as var(--annoudio-…, default)
// and never declares a --annoudio-* property (CONTRACT 3.1, rule 2).
// The project theme is a second sheet that declares tokens on :host.

const css = String.raw;

export const BASE_CSS = css`
:host {
  all: initial;
  display: block;
  font-family: inherit;
  font-size: inherit;
}
:host([hidden]) { display: none; }
*, *::before, *::after { box-sizing: border-box; }

/* The frame resets every inherited property that the host could set on the element.
   font-family and font-size inherit on purpose (table 3.1): an unset token falls back to inherit. */
.frame {
  font-family: var(--annoudio-font-family);
  font-size: var(--annoudio-font-size);
  font-weight: 400;
  font-style: normal;
  font-variant: normal;
  line-height: 1.4;
  letter-spacing: normal;
  word-spacing: normal;
  text-transform: none;
  text-align: start;
  text-indent: 0;
  text-shadow: none;
  white-space: normal;
  color-scheme: light;
  cursor: auto;
  visibility: visible;
  color: var(--annoudio-color-text, #1f1f1f);
  background: var(--annoudio-color-surface, #ffffff);
  border: 1px solid var(--annoudio-color-border, #767676);
  border-radius: var(--annoudio-radius, 6px);
  padding: var(--annoudio-space, 0.5em);
  display: flex;
  flex-direction: column;
  gap: var(--annoudio-space, 0.5em);
  min-width: 0;
  overflow-wrap: anywhere;
}

button, input, a { font: inherit; color: inherit; }
:focus-visible {
  outline: 2px solid var(--annoudio-color-focus, #0b5cad);
  outline-offset: 2px;
}

.message { margin: 0; color: var(--annoudio-color-text, #1f1f1f); }
.message:empty { display: none; }

.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--annoudio-space, 0.5em);
}
.controls[hidden] { display: none; }

.play {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.5em;
  min-height: 2.5em;
  width: 2.5em;
  height: 2.5em;
  padding: 0;
  margin: 0;
  border: 0;
  border-radius: var(--annoudio-radius, 6px);
  background: var(--annoudio-color-accent, #0b5cad);
  color: var(--annoudio-color-on-accent, #ffffff);
  cursor: pointer;
}
.play:hover, .open:hover { box-shadow: 0 0 0 2px var(--annoudio-color-border, #767676); }
.play svg { width: 1.1em; height: 1.1em; fill: currentColor; }

.time {
  flex: none;
  color: var(--annoudio-color-muted, #595959);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.timeline {
  flex: 1 1 12em;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25em;
}
.timeline[hidden] { display: none; }
.wave {
  position: relative;
  height: var(--annoudio-timeline-height, 64px);
  border-bottom: 1px solid var(--annoudio-color-border, #767676);
}
.wave > div { height: 100%; }
/* The regions lie over the waveform: let the bars show through. */
.wave > div::part(region) { cursor: pointer; opacity: 0.6; }
.wave > div::part(region active) {
  opacity: 0.9;
  box-shadow: inset 2px 0 0 var(--annoudio-color-accent, #0b5cad), inset -2px 0 0 var(--annoudio-color-accent, #0b5cad);
}

.seek {
  width: 100%;
  min-height: 24px;
  margin: 0;
  accent-color: var(--annoudio-color-accent, #0b5cad);
  cursor: pointer;
  background: transparent;
}

.stories {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.stories:empty { display: none; }
.story {
  margin: 0;
  padding: var(--annoudio-space, 0.5em);
  border-top: 1px solid var(--annoudio-color-border, #767676);
  border-left: 3px solid transparent;
}
.story.active { border-left-color: var(--annoudio-color-accent, #0b5cad); }
.open {
  display: inline-block;
  min-height: 24px;
  margin: 0;
  padding: 0.125em 0.25em;
  border: 0;
  border-radius: var(--annoudio-radius, 6px);
  background: transparent;
  text-align: start;
  cursor: pointer;
}
.meta { color: var(--annoudio-color-muted, #595959); font-size: 0.875em; }
.text { margin: 0.25em 0 0; white-space: pre-line; }
.media { display: block; max-width: 100%; margin: 0.25em 0 0; }
img.media, video.media { max-height: 20em; border-radius: var(--annoudio-radius, 6px); }
.tags { list-style: none; margin: 0.25em 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.25em; }
.tag {
  margin: 0;
  padding: 0 0.5em;
  border: 1px solid var(--annoudio-color-border, #767676);
  border-radius: var(--annoudio-radius, 6px);
  font-size: 0.875em;
}

/* The thread under the open story. */
.count { display: block; color: var(--annoudio-color-muted, #595959); font-size: 0.875em; }
.thread { margin: 0.25em 0 0 0.75em; }
.replies {
  list-style: none;
  margin: 0;
  padding: 0;
}
.reply {
  margin: 0;
  padding: 0.25em 0 0.25em var(--annoudio-space, 0.5em);
  border-left: 1px solid var(--annoudio-color-border, #767676);
}
.reply .meta { margin: 0; }

.annotate {
  align-self: flex-start;
  display: inline-block;
  min-height: 24px;
  padding: 0.125em 0;
  color: var(--annoudio-color-accent, #0b5cad);
  text-decoration: underline;
}

.rights {
  margin: 0;
  color: var(--annoudio-color-muted, #595959);
  font-size: 0.875em;
}
.rights a {
  display: inline-block;
  min-height: 24px;
  color: var(--annoudio-color-accent, #0b5cad);
  text-decoration: underline;
}

.probe { display: none; }

@media (prefers-reduced-motion: no-preference) {
  /* Only box-shadow moves. Colours must not animate: a late project theme replaces them in place. */
  .play, .open { transition: box-shadow 0.15s ease; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition: none !important; animation: none !important; scroll-behavior: auto !important; }
}

@media (forced-colors: active) {
  .play { border: 1px solid ButtonText; }
  .wave > div::part(region) { border: 1px solid CanvasText; }
  .wave > div::part(region active) { border: 2px solid Highlight; }
  .story.active { border-left-color: Highlight; }
}
`;

/**
 * A copy of the layout rules that wavesurfer.js writes into its own shadow root as a <style>
 * element (wavesurfer.js 8.0.2, renderer.js initHtml). A strict CSP `style-src` blocks that
 * element; a constructed sheet is not blocked. So the player adopts this copy into that root.
 */
export const WAVE_CSS = css`
:host { user-select: none; min-width: 1px; }
.scroll { overflow-x: auto; overflow-y: hidden; width: 100%; height: 100%; position: relative; }
.noScrollbar { scrollbar-color: transparent; scrollbar-width: none; }
.noScrollbar::-webkit-scrollbar { display: none; -webkit-appearance: none; }
.wrapper { position: relative; overflow: visible; z-index: 2; height: 100%; }
.canvases { pointer-events: none; }
.canvases > div { position: relative; }
canvas { display: block; position: absolute; top: 0; image-rendering: pixelated; }
.progress { pointer-events: none; position: absolute; z-index: 2; top: 0; left: 0; width: 0; height: 100%; overflow: hidden; }
.progress > div { position: relative; }
.cursor { pointer-events: none; position: absolute; z-index: 5; top: 0; left: 0; height: 100%; border-radius: 2px; }
`;

let waveSheet: CSSStyleSheet | null = null;

export function waveformSheet(): CSSStyleSheet {
  if (!waveSheet) {
    waveSheet = new CSSStyleSheet();
    waveSheet.replaceSync(WAVE_CSS);
  }
  return waveSheet;
}

let sheet: CSSStyleSheet | null = null;

/** One base sheet for all players on the page. */
export function baseSheet(): CSSStyleSheet {
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(BASE_CSS);
  }
  return sheet;
}
