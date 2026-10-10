// The loader: /embed/v1.js. A classic script (CONTRACT.md section 5).
// It finds its own origin, imports the hashed bundle, and gives the bundle that origin.
// If the import fails, it defines a small fallback element that shows `bundle-unavailable`.
// It never throws into the host page and makes no global variables.

declare const __ANNOUDIO_BUNDLE__: string;

(function () {
  const NAME = "annoudio-player";
  const MESSAGE = "The widget could not load. Reload the page to try again.";

  // Step 1: read our own URL synchronously, before any await (CONTRACT 2.3).
  let src = "";
  try {
    const current = document.currentScript as HTMLScriptElement | null;
    src = current && current.src ? current.src : "";
    if (!src) {
      const scripts = document.querySelectorAll("script[src]");
      for (let i = scripts.length - 1; i >= 0; i--) {
        const candidate = (scripts[i] as HTMLScriptElement).src;
        if (/\/embed\/v1\.js(?:[?#]|$)/.test(candidate)) {
          src = candidate;
          break;
        }
      }
    }
  } catch {
    src = "";
  }

  try {
    const registry = window.customElements;
    // Step 2: no custom elements, no player. Fallback content stays.
    if (!registry) return;
    // Step 3: a second copy of the snippet stops here.
    if (registry.get(NAME)) return;
    if (!src) {
      console.warn("annoudio: the loader could not find its own URL.");
      return;
    }
    const origin = new URL(src).origin;

    const fallback = (reason: unknown) => {
      try {
        console.warn("annoudio: bundle-unavailable:", reason);
        if (registry.get(NAME)) return;
        registry.define(
          NAME,
          class extends HTMLElement {
            connectedCallback() {
              try {
                if (this.shadowRoot) return;
                const root = this.attachShadow({ mode: "open" });
                const p = document.createElement("p");
                p.setAttribute("part", "message");
                p.setAttribute("role", "status");
                p.textContent = MESSAGE;
                root.appendChild(p);
                const read = (name: string) => (this.getAttribute(name) || "").trim() || null;
                this.dispatchEvent(
                  new CustomEvent("annoudio:error", {
                    bubbles: true,
                    composed: true,
                    detail: {
                      project: read("project"),
                      recording: read("recording"),
                      code: "bundle-unavailable",
                      message: MESSAGE,
                    },
                  }),
                );
              } catch (error) {
                console.warn("annoudio:", error);
              }
            }
          },
        );
      } catch (error) {
        console.warn("annoudio:", error);
      }
    };

    // Step 4: import the bundle. The browser evaluates one module URL once.
    import(origin + __ANNOUDIO_BUNDLE__).then(
      (bundle: { define?: (origin: string) => void }) => {
        try {
          if (typeof bundle.define !== "function") throw new Error("the bundle has no define()");
          bundle.define(origin);
        } catch (error) {
          fallback(error);
        }
      },
      fallback,
    );
  } catch (error) {
    try {
      console.warn("annoudio:", error);
    } catch {
      // Nothing more is safe to do.
    }
  }
})();
