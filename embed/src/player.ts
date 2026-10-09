// The bundle: /embed/v1/<hash>/player.js. The loader imports it and calls define(origin).
// It defines <annoudio-player> once (CONTRACT 5, step 5).

import { AnnoudioPlayer, NAME, setDefaultOrigin } from "./element";

export function define(origin: string): void {
  try {
    if (customElements.get(NAME)) return;
    setDefaultOrigin(origin);
    customElements.define(NAME, AnnoudioPlayer);
  } catch (error) {
    console.warn("annoudio:", error);
  }
}
