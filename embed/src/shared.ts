// One request per key per page, shared by all players that ask for it
// (CONTRACT 6, rule 7). A settled result stays for the life of the page.
// When every player that waits for an unsettled request leaves, the request is aborted.

interface Entry<T> {
  promise: Promise<T>;
  controller: AbortController;
  waiting: number;
  settled: boolean;
}

export type Loader<T> = (signal: AbortSignal) => Promise<T>;

export class SharedRequests<T> {
  readonly #entries = new Map<string, Entry<T>>();

  get(key: string, load: Loader<T>, signal: AbortSignal): Promise<T> {
    let entry = this.#entries.get(key);
    if (!entry) {
      const controller = new AbortController();
      const created: Entry<T> = {
        controller,
        waiting: 0,
        settled: false,
        promise: Promise.resolve(),
      } as Entry<T>;
      created.promise = load(controller.signal).finally(() => {
        created.settled = true;
      });
      // A rejected entry (only an abort) must not stay in the map.
      created.promise.catch(() => {
        if (this.#entries.get(key) === created) this.#entries.delete(key);
      });
      this.#entries.set(key, created);
      entry = created;
    }
    const current = entry;
    if (current.settled) return current.promise;

    current.waiting += 1;
    return new Promise<T>((resolve, reject) => {
      const leave = () => {
        current.waiting -= 1;
        reject(new DOMException("The player left the page.", "AbortError"));
        if (current.waiting === 0 && !current.settled) {
          current.controller.abort();
          if (this.#entries.get(key) === current) this.#entries.delete(key);
        }
      };
      if (signal.aborted) {
        leave();
        return;
      }
      signal.addEventListener("abort", leave, { once: true });
      current.promise.then(
        (value) => {
          signal.removeEventListener("abort", leave);
          current.waiting -= 1;
          resolve(value);
        },
        (error: unknown) => {
          signal.removeEventListener("abort", leave);
          current.waiting -= 1;
          reject(error);
        },
      );
    });
  }
}

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
