import type { AppState } from '@/store/types'

export type PaletteStatusInputsState = Pick<
  AppState,
  | 'agentStatusByPaneKey'
  | 'runtimePaneTitlesByTabId'
  | 'ptyIdsByTabId'
  | 'terminalLayoutsByTabId'
  | 'tabsByWorktree'
>

export type PaletteStatusInputs = Pick<
  PaletteStatusInputsState,
  'ptyIdsByTabId' | 'terminalLayoutsByTabId' | 'tabsByWorktree'
>

/** The two hottest maps, read as a snapshot rather than subscribed. See `selectPaletteIndexStatusSnapshot`. */
export type PaletteIndexStatusSnapshot = Pick<
  PaletteStatusInputsState,
  'agentStatusByPaneKey' | 'runtimePaneTitlesByTabId'
>

const EMPTY_PALETTE_INDEX_STATUS: PaletteIndexStatusSnapshot = Object.freeze({
  agentStatusByPaneKey: {},
  runtimePaneTitlesByTabId: {}
})

/**
 * The agent-status and pane-title maps as of *now*, for the palette's index, ordering and filters.
 *
 * Read through `useAppStore.getState()` inside a memo rather than subscribed: both maps get a new
 * identity on every agent transition and every pane-title write app-wide, and subscribing re-rendered
 * the entire palette on that churn to change nothing but the status dots. The dots subscribe
 * themselves (`PaletteLiveStatusProvider`), so what is left here only needs a snapshot — refreshed
 * when the palette opens or the tab set changes, which is the same freeze-on-open the recent row
 * order already relies on. Frozen empty constant while inactive so the memo can't hold live maps
 * alive across a close.
 */
export function selectPaletteIndexStatusSnapshot(
  s: PaletteStatusInputsState,
  active: boolean
): PaletteIndexStatusSnapshot {
  if (!active) {
    return EMPTY_PALETTE_INDEX_STATUS
  }
  return {
    agentStatusByPaneKey: s.agentStatusByPaneKey,
    runtimePaneTitlesByTabId: s.runtimePaneTitlesByTabId
  }
}

// Why: shared frozen bundle returned whenever the Cmd+J jump palette isn't active. The palette is
// always mounted (App.tsx renders <CommandDialog open={visible}>) and stays mounted for the whole
// session once opened, so subscribing while it's closed re-rendered the whole palette on unrelated
// terminal chatter. A useShallow subscription keeps this same reference across that churn, so the
// closed palette stops reacting. Frozen so the shared singleton can't be mutated.
export const EMPTY_PALETTE_STATUS_INPUTS: PaletteStatusInputs = Object.freeze({
  ptyIdsByTabId: {},
  terminalLayoutsByTabId: {},
  tabsByWorktree: {}
})

/**
 * Select the status maps the jump palette subscribes to — but only while it's `active` (open, or
 * still animating closed). While inactive nothing is shown, so return a stable frozen constant that
 * a `useShallow`-wrapped subscription keeps referentially equal, skipping the re-render that would
 * otherwise fire on the always-mounted palette.
 *
 * These three are the ones that must stay live even while open: the tab set changes under the
 * palette (a tab closing has to backfill the recent section), and PTY liveness decides whether a
 * workspace counts as sleeping. The two *hot* maps are deliberately absent — see
 * `selectPaletteIndexStatusSnapshot`.
 */
export function selectPaletteStatusInputs(
  s: PaletteStatusInputsState,
  active: boolean
): PaletteStatusInputs {
  if (!active) {
    return EMPTY_PALETTE_STATUS_INPUTS
  }
  return {
    ptyIdsByTabId: s.ptyIdsByTabId,
    terminalLayoutsByTabId: s.terminalLayoutsByTabId,
    tabsByWorktree: s.tabsByWorktree
  }
}
