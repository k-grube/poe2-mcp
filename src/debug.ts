// verbose subprocess/http tracing, off unless POE2_DEBUG is set
export const DEBUG = process.env.POE2_DEBUG === '1' || process.env.POE2_DEBUG === 'true'

export function dbg(message: string): void {
  if (DEBUG) {
    process.stderr.write(message)
  }
}
