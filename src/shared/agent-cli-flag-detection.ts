/** Matches an exact token, the `flag=value` form, and clustered single-dash flags (`-mopus`). */
export function hasFlag(tokens: readonly string[], flags: readonly string[]): boolean {
  for (const token of tokens) {
    // Everything past the option terminator is positional, however flag-shaped it looks.
    if (token === '--') {
      return false
    }
    const matches = flags.some(
      (flag) =>
        token === flag ||
        token.startsWith(`${flag}=`) ||
        (flag.startsWith('-') && !flag.startsWith('--') && token.startsWith(flag))
    )
    if (matches) {
      return true
    }
  }
  return false
}
