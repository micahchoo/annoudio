import { execFile } from 'node:child_process'

/**
 * Run a program without a shell and give its stdout.
 * Rejects when the program exits with an error or runs longer than `timeoutMs`.
 * The error message holds the last lines of stderr.
 */
export function run(command: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { timeout: timeoutMs, killSignal: 'SIGKILL', maxBuffer: 16 * 1024 * 1024, encoding: 'utf8' },
      (error, stdout, stderr) => {
        if (!error) return resolve(stdout)
        const reason = error.killed ? `timed out after ${timeoutMs} ms` : `exit code ${String(error.code)}`
        const lines = stderr.trim().split('\n').slice(-5).join('\n')
        reject(new Error(`${command} failed (${reason})${lines ? `: ${lines}` : ''}`))
      },
    )
  })
}
