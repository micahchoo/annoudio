// Options that ffmpeg and ffprobe put before every input.
// An upload can be a playlist (HLS, concat) that names other files or URLs. These options
// stop the demuxer from opening anything but the input itself.

/** The demuxers for the accepted formats. ffmpeg matches each name of a demuxer such as `mov,mp4,m4a`. */
const DEMUXERS = 'matroska,ogg,mov,mp3,wav,flac,image2,jpeg_pipe,png_pipe,webp_pipe'

/** `local` reads one file. `remote` reads one http(s) URL and stops after 15 s without data. */
export function inputGuard(source: 'local' | 'remote'): string[] {
  const protocols =
    source === 'local'
      ? ['-protocol_whitelist', 'file']
      : ['-protocol_whitelist', 'http,https,tcp,tls', '-rw_timeout', '15000000']
  return [...protocols, '-format_whitelist', DEMUXERS]
}
