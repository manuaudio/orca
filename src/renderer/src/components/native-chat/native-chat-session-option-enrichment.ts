import type { AgentType } from '../../../../shared/agent-status-types'
import {
  getAgentSessionOptionCatalog,
  mergeCatalogModels,
  mergeDiscoveredAuthoritativeModels,
  type CatalogModel
} from '../../../../shared/agent-session-option-catalog'
import { resolveNativeChatSessionOptionDefaults } from '../../../../shared/native-chat-session-option-defaults'
import type {
  PersistedNativeChatSessionOptions,
  SessionOptionValue
} from '../../../../shared/native-chat-session-options'

type CatalogEnrichmentEntry = {
  state: 'idle' | 'pending' | 'settled'
  models: CatalogModel[] | null
  listeners: Set<(models: CatalogModel[]) => void>
}

const enrichmentByAgentHost = new Map<string, CatalogEnrichmentEntry>()

// Why separate from the evictable cache above: this is launch-validation evidence, and
// evicting the host rows that prove a persisted model retired would silently re-authorize
// the fatal `-m`. Keyed by agent, not host, so it stays bounded as host keys grow.
const probedAuthoritativeModelIdsByAgent = new Map<AgentType, Set<string>>()

// Host keys are unbounded (one per SSH host), so cap the process-lifetime cache.
// An evicted host simply re-probes on its next visit; live listeners are kept.
const MAX_ENRICHMENT_ENTRIES = 64

function evictSettledEnrichmentEntry(): void {
  if (enrichmentByAgentHost.size < MAX_ENRICHMENT_ENTRIES) {
    return
  }
  for (const [key, entry] of enrichmentByAgentHost) {
    if (entry.state === 'settled' && entry.listeners.size === 0) {
      enrichmentByAgentHost.delete(key)
      return
    }
  }
}

function enrichmentKey(agent: AgentType, hostKey: string): string {
  return JSON.stringify([agent, hostKey])
}

export function readNativeChatEnrichedModels(
  agent: AgentType,
  hostKey: string
): CatalogModel[] | null {
  const models = enrichmentByAgentHost.get(enrichmentKey(agent, hostKey))?.models
  return models ? [...models] : null
}

export function subscribeNativeChatEnrichedModels(
  agent: AgentType,
  hostKey: string,
  listener: (models: CatalogModel[]) => void
): () => void {
  const key = enrichmentKey(agent, hostKey)
  const entry = enrichmentByAgentHost.get(key) ?? {
    state: 'idle' as const,
    models: null,
    listeners: new Set<(models: CatalogModel[]) => void>()
  }
  entry.listeners.add(listener)
  enrichmentByAgentHost.set(key, entry)
  return () => entry.listeners.delete(listener)
}

// Why: drop a persisted `-m` only when every settled host probe omits it; no probe yet → keep it.
export function resolveNativeChatLaunchSessionOptions(
  persisted: PersistedNativeChatSessionOptions | null | undefined,
  agent: AgentType
): Record<string, SessionOptionValue> | undefined {
  const values = resolveNativeChatSessionOptionDefaults(persisted, agent)
  if (!values || !getAgentSessionOptionCatalog(agent)?.discoveredModelsAreAuthoritative) {
    return values
  }
  const probedModelIds = probedAuthoritativeModelIdsByAgent.get(agent)
  if (!probedModelIds) {
    return values
  }
  return probedModelIds.has(String(values.model)) ? values : undefined
}

export function ensureNativeChatModelEnrichment(args: {
  agent: AgentType
  hostKey: string
  discover: () => Promise<readonly CatalogModel[] | null>
}): void {
  const catalog = getAgentSessionOptionCatalog(args.agent)
  if (!catalog?.listModels) {
    return
  }
  const key = enrichmentKey(args.agent, args.hostKey)
  const existing = enrichmentByAgentHost.get(key)
  if (existing?.state === 'pending' || existing?.state === 'settled') {
    return
  }
  const entry: CatalogEnrichmentEntry = existing ?? {
    state: 'idle',
    models: null,
    listeners: new Set()
  }
  entry.state = 'pending'
  if (!existing) {
    evictSettledEnrichmentEntry()
  }
  enrichmentByAgentHost.set(key, entry)

  // Why: model discovery must never delay rendering or launching; the seed is
  // immediately usable while this once-per-host probe runs in the background.
  void args
    .discover()
    .then((discovered) => {
      entry.state = 'settled'
      if (!discovered || discovered.length === 0) {
        return
      }
      entry.models =
        args.agent === 'claude'
          ? [...discovered]
          : catalog.discoveredModelsAreAuthoritative
            ? mergeDiscoveredAuthoritativeModels(catalog.models, discovered)
            : mergeCatalogModels(catalog.models, discovered)
      if (catalog.discoveredModelsAreAuthoritative) {
        const probedModelIds =
          probedAuthoritativeModelIdsByAgent.get(args.agent) ?? new Set<string>()
        for (const model of entry.models) {
          probedModelIds.add(model.id)
        }
        probedAuthoritativeModelIdsByAgent.set(args.agent, probedModelIds)
      }
      for (const listener of entry.listeners) {
        listener([...entry.models])
      }
    })
    .catch(() => {
      entry.state = 'settled'
    })
}

export function clearNativeChatModelEnrichmentForTests(): void {
  enrichmentByAgentHost.clear()
  probedAuthoritativeModelIdsByAgent.clear()
}
