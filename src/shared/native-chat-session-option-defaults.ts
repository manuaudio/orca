import type { AgentType } from './agent-status-types'
import { sessionOptionValueIsValid } from './agent-session-option-catalog'
import type {
  PersistedNativeChatSessionOptions,
  SessionOptionValue
} from './native-chat-session-options'

export function resolveNativeChatSessionOptionDefaults(
  persisted: PersistedNativeChatSessionOptions | null | undefined,
  agent: AgentType
): Record<string, SessionOptionValue> | undefined {
  const entry = persisted?.[agent]
  // Why: untouched settings must preserve the agent CLI's configured defaults;
  // only a model explicitly selected by the user authorizes launch flags.
  const modelId = typeof entry?.model === 'string' && entry.model.trim() ? entry.model : undefined
  if (!modelId) {
    return undefined
  }
  const values: Record<string, SessionOptionValue> = { model: modelId }
  const storedValues = entry?.valuesByModel?.[modelId]
  if (storedValues && typeof storedValues === 'object') {
    for (const [id, value] of Object.entries(storedValues)) {
      if (sessionOptionValueIsValid(value)) {
        values[id] = value
      }
    }
  }
  return values
}

/** Why: an authoritative probe proved this id gone, and a stale `model` is emitted
 *  verbatim as a launch flag — grok exits fatally on an unknown one. Dropping only
 *  `model` keeps the per-model option values for a later reselect. */
export function clearNativeChatSessionOptionModel(
  persisted: PersistedNativeChatSessionOptions | null | undefined,
  agent: AgentType
): PersistedNativeChatSessionOptions {
  const currentAgent = persisted?.[agent]
  if (!currentAgent?.model) {
    return { ...persisted }
  }
  const { model: _dropped, ...rest } = currentAgent
  return { ...persisted, [agent]: rest }
}

export function updateNativeChatSessionOptionDefaults(args: {
  persisted: PersistedNativeChatSessionOptions | null | undefined
  agent: AgentType
  modelId: string
  optionId: string
  value: SessionOptionValue
  /** The model only scopes this value; the user never picked it. Adopting it would
   *  emit `-m` on every later launch — see the invariant above. */
  modelIsCliDefault?: boolean
}): PersistedNativeChatSessionOptions {
  const currentAgent = args.persisted?.[args.agent]
  const currentModelValues = currentAgent?.valuesByModel?.[args.modelId] ?? {}
  const valuesByModel = {
    ...currentAgent?.valuesByModel,
    ...(args.optionId === 'model'
      ? {}
      : {
          [args.modelId]: { ...currentModelValues, [args.optionId]: args.value }
        })
  }
  return {
    ...args.persisted,
    [args.agent]: {
      ...currentAgent,
      ...(args.modelIsCliDefault
        ? {}
        : { model: args.optionId === 'model' ? String(args.value) : args.modelId }),
      valuesByModel
    }
  }
}
