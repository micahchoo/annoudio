// Request 5 (CONTRACT 6): the optional waveform. The player fetches `src` with CORS,
// decodes it, and keeps one peak per bucket. Any failure means "no waveform", which is not an error.

/** Implementation limit (CONTRACT 6, rule 8). It can change. */
export const MAX_WAVEFORM_BYTES = 20_000_000;
const BUCKETS = 1000;

export interface Peaks {
  peaks: Float32Array;
  duration: number;
}

export async function loadPeaks(src: string, signal: AbortSignal): Promise<Peaks | null> {
  const controller = new AbortController();
  const stop = () => controller.abort();
  signal.addEventListener("abort", stop, { once: true });
  try {
    const response = await fetch(src, { mode: "cors", credentials: "omit", signal: controller.signal });
    const length = Number(response.headers.get("content-length"));
    if (!response.ok || !response.headers.has("content-length") || !(length > 0) || length > MAX_WAVEFORM_BYTES) {
      controller.abort();
      return null;
    }
    const bytes = await response.arrayBuffer();
    const context = new OfflineAudioContext(1, 1, 8000);
    const audio = await context.decodeAudioData(bytes);
    return { peaks: reduce(audio), duration: audio.duration };
  } catch {
    return null;
  } finally {
    signal.removeEventListener("abort", stop);
  }
}

function reduce(audio: AudioBuffer): Float32Array {
  const data = audio.getChannelData(0);
  const size = Math.min(BUCKETS, data.length);
  const out = new Float32Array(size);
  const step = data.length / size;
  for (let i = 0; i < size; i++) {
    let max = 0;
    const end = Math.min(data.length, Math.floor((i + 1) * step));
    for (let j = Math.floor(i * step); j < end; j++) {
      const v = Math.abs(data[j] ?? 0);
      if (v > max) max = v;
    }
    out[i] = max;
  }
  return out;
}
