import type { CommitMessageModel } from './commit-message-agent-spec'
import { labelFromModelId } from './model-id-label'

// Why: `grok models` has no --json and no --format, so its human-readable
// listing is the only machine surface available.
export const GROK_MODEL_LIST_ARGS = ['models']

const AVAILABLE_MODELS_HEADER = 'Available models:'
const MODEL_BULLET = /^\s*\*\s+([^\s(]+)(.*)$/
// Why: read off the row rather than the earlier `Default model:` line, so the marker
// cannot name an id the listing does not actually offer.
const DEFAULT_MARKER = /\(default\)/

export function parseGrokModelList(stdout: string): CommitMessageModel[] {
  const lines = stdout.split(/\r?\n/)
  // Why: `Default model: grok-4.5` precedes the header and the login line holds a
  // dotted token, so anything scanning the whole output invents phantom models.
  const headerIndex = lines.findIndex((line) => line.trim() === AVAILABLE_MODELS_HEADER)
  if (headerIndex === -1) {
    return []
  }
  const models: CommitMessageModel[] = []
  const indexById = new Map<string, number>()
  for (const line of lines.slice(headerIndex + 1)) {
    // Why: grok separates sections with a blank line, so ending there keeps a trailing
    // hint or footer bullet from entering the list as a selectable — and launchable — id.
    if (line.trim() === '' && models.length > 0) {
      break
    }
    const match = MODEL_BULLET.exec(line)
    const id = match?.[1]
    if (!id) {
      continue
    }
    const isDefault = DEFAULT_MARKER.test(match[2])
    const existingIndex = indexById.get(id)
    if (existingIndex !== undefined) {
      // A repeat row still carries the marker's news, even though the id is not new.
      if (isDefault) {
        models[existingIndex]!.isDefault = true
      }
      continue
    }
    indexById.set(id, models.length)
    models.push({ id, label: labelFromModelId(id), ...(isDefault ? { isDefault: true } : {}) })
  }
  return models
}
