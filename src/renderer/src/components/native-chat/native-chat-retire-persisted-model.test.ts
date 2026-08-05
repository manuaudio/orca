import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CatalogModel } from '../../../../shared/agent-session-option-catalog'
import type { PersistedNativeChatSessionOptions } from '../../../../shared/native-chat-session-options'

const mocks = vi.hoisted(() => ({
  storeState: {
    settings: {} as { nativeChatSessionOptions?: PersistedNativeChatSessionOptions },
    updateSettings: vi.fn()
  }
}))

vi.mock('../../store', () => ({ useAppStore: { getState: () => mocks.storeState } }))

const { retirePersistedModelMissingFromDiscovery } =
  await import('./use-native-chat-session-options')

const models = (...ids: string[]): CatalogModel[] =>
  ids.map((id) => ({ id, label: id, options: [] }))

function persist(options: PersistedNativeChatSessionOptions): void {
  mocks.storeState.settings = { nativeChatSessionOptions: options }
}

/** The persisted model becomes `-m <id>` at every launch site, including ones that
 *  never render the picker, and grok exits fatally on an id it no longer lists. */
describe('retirePersistedModelMissingFromDiscovery', () => {
  beforeEach(() => {
    mocks.storeState.updateSettings.mockReset().mockResolvedValue(undefined)
    mocks.storeState.settings = {}
  })

  it('clears a persisted id the authoritative probe no longer lists', async () => {
    persist({ grok: { model: 'grok-build', valuesByModel: { 'grok-build': { effort: 'low' } } } })
    await retirePersistedModelMissingFromDiscovery('grok', models('grok-4.5'))
    expect(mocks.storeState.updateSettings).toHaveBeenCalledWith({
      // Why keep valuesByModel: the option values are still valid if the user
      // reselects that model on another host.
      nativeChatSessionOptions: {
        grok: { valuesByModel: { 'grok-build': { effort: 'low' } } }
      }
    })
  })

  it('keeps a persisted id the probe still lists', async () => {
    persist({ grok: { model: 'grok-4.5' } })
    await retirePersistedModelMissingFromDiscovery('grok', models('grok-4.5', 'grok-build'))
    expect(mocks.storeState.updateSettings).not.toHaveBeenCalled()
  })

  it('treats an empty list as a failed probe, not an empty account', async () => {
    persist({ grok: { model: 'grok-build' } })
    await retirePersistedModelMissingFromDiscovery('grok', [])
    expect(mocks.storeState.updateSettings).not.toHaveBeenCalled()
  })

  it('leaves additive agents alone, whose lists extend the seed rather than replace it', async () => {
    // Cursor's probe not listing a model is no evidence the model is gone.
    persist({ cursor: { model: 'gpt-5.3-codex' } })
    await retirePersistedModelMissingFromDiscovery('cursor', models('auto'))
    expect(mocks.storeState.updateSettings).not.toHaveBeenCalled()
  })

  it('does nothing when no model was ever persisted', async () => {
    persist({ grok: { valuesByModel: { 'grok-4.5': { effort: 'high' } } } })
    await retirePersistedModelMissingFromDiscovery('grok', models('grok-4.5'))
    expect(mocks.storeState.updateSettings).not.toHaveBeenCalled()
  })

  it('survives settings that were never written', async () => {
    mocks.storeState.settings = {}
    await expect(
      retirePersistedModelMissingFromDiscovery('grok', models('grok-4.5'))
    ).resolves.toBeUndefined()
    expect(mocks.storeState.updateSettings).not.toHaveBeenCalled()
  })

  it('retires only the named agent, leaving other agents’ picks intact', async () => {
    persist({ grok: { model: 'grok-build' }, claude: { model: 'opus' } })
    await retirePersistedModelMissingFromDiscovery('grok', models('grok-4.5'))
    expect(mocks.storeState.updateSettings).toHaveBeenCalledWith({
      nativeChatSessionOptions: { grok: {}, claude: { model: 'opus' } }
    })
  })
})
