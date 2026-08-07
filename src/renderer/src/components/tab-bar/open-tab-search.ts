// Merges the three Cmd+J open-tab engines into one ranked list for the new-tab
// omnibox. Pure: no store, no React.

import { isClipboardTextByteLengthOverLimit } from '../../../../shared/clipboard-text'
import {
  searchBrowserPages,
  type BrowserPaletteSearchResult,
  type SearchableBrowserPage
} from '@/lib/browser-palette-search'
import {
  searchSimulatorTabs,
  type SearchableSimulatorTab,
  type SimulatorPaletteSearchResult
} from '@/lib/simulator-palette-search'
import {
  searchWorkspaceTabs,
  type SearchableWorkspaceTab,
  type WorkspaceTabContentType,
  type WorkspaceTabPaletteSearchResult
} from '@/lib/workspace-tab-palette-search'

export const OPEN_TAB_SEARCH_RESULT_LIMIT = 4

// Why its own guard: searchWorkspaceTabs has no size limit of its own.
export const OPEN_TAB_SEARCH_QUERY_MAX_BYTES = 2 * 1024

export type OpenTabSearchSource = 'workspace' | 'browser' | 'simulator'

type OpenTabSearchResultBase = {
  /** Stable across renders, so selection survives the deferred query. */
  id: string
  title: string
  /** Engine secondary text when the match came from a secondary field. */
  matchedText: string | null
  worktreeId: string
}

export type OpenTabSearchResult =
  | (OpenTabSearchResultBase & {
      source: 'workspace'
      contentType: WorkspaceTabContentType
      tabId: string
      entityId: string
      groupId: string
      relativePath: string | null
    })
  | (OpenTabSearchResultBase & {
      source: 'browser'
      contentType: 'browser'
      pageId: string
      workspaceId: string
    })
  | (OpenTabSearchResultBase & {
      source: 'simulator'
      contentType: 'simulator'
      tabId: string
      groupId: string
    })

export type OpenTabSearchInput = {
  workspaceTabs: readonly SearchableWorkspaceTab[]
  browserPages: readonly SearchableBrowserPage[]
  simulatorTabs: readonly SearchableSimulatorTab[]
  query: string
}

type RankedResult = {
  result: OpenTabSearchResult
  tier: number
  sourceRank: number
  score: number
}

const SOURCE_RANK: Record<OpenTabSearchSource, number> = {
  workspace: 0,
  browser: 1,
  simulator: 2
}

const TITLE_PREFIX_TIER = 0
const TITLE_SUBSTRING_TIER = 1
// Why one tier for every secondary match: path and agent-snippet matches share
// `secondaryRange`, so splitting on offset would outrank the engine's own field
// weights. See the plan's tiering decision.
const SECONDARY_TIER = 2

export function isOpenTabSearchQueryTooLarge(
  query: string,
  maxBytes = OPEN_TAB_SEARCH_QUERY_MAX_BYTES
): boolean {
  return isClipboardTextByteLengthOverLimit(query, maxBytes)
}

type EngineResult =
  | WorkspaceTabPaletteSearchResult
  | BrowserPaletteSearchResult
  | SimulatorPaletteSearchResult

// Why the positive signal rather than "no title and no secondary range": the
// simulator alias branch and the browser workspace-label branch are real matches
// that carry neither range, and would be dropped by the inverse test.
function isNameOnlyMatch(result: EngineResult): boolean {
  return result.worktreeRange !== null || result.repoRange !== null
}

function getTier(result: EngineResult): number {
  if (!result.titleRange) {
    return SECONDARY_TIER
  }
  return result.titleRange.start === 0 ? TITLE_PREFIX_TIER : TITLE_SUBSTRING_TIER
}

function getMatchedText(result: EngineResult): string | null {
  return result.secondaryRange ? result.secondaryText : null
}

// Why read the path off the entry: the engine overwrites `secondaryText` with
// whichever string matched, and an absolute-path match leaves no relative path.
function getEditorRelativePath(entry: SearchableWorkspaceTab | undefined): string | null {
  if (!entry || entry.tab.contentType === 'terminal') {
    return null
  }
  return entry.secondaryText || null
}

function rankWorkspaceTabs(
  entries: readonly SearchableWorkspaceTab[],
  query: string
): RankedResult[] {
  const entriesByTabId = new Map(entries.map((entry) => [entry.tab.id, entry]))
  // Why no isCurrentTab filter here: Cmd+J lists the tab you are on, and hiding it
  // made the omnibox look broken when you searched for the tab on screen.
  return searchWorkspaceTabs([...entries], query)
    .filter((result) => !isNameOnlyMatch(result))
    .map((result) => ({
      tier: getTier(result),
      sourceRank: SOURCE_RANK.workspace,
      score: result.score,
      result: {
        source: 'workspace' as const,
        id: `open-tab:workspace:${result.tabId}`,
        title: result.title,
        matchedText: getMatchedText(result),
        worktreeId: result.worktreeId,
        contentType: result.contentType,
        tabId: result.tabId,
        entityId: result.entityId,
        groupId: result.groupId,
        relativePath: getEditorRelativePath(entriesByTabId.get(result.tabId))
      }
    }))
}

function rankBrowserPages(
  entries: readonly SearchableBrowserPage[],
  query: string
): RankedResult[] {
  return searchBrowserPages([...entries], query)
    .filter((result) => !isNameOnlyMatch(result))
    .map((result) => ({
      tier: getTier(result),
      sourceRank: SOURCE_RANK.browser,
      score: result.score,
      result: {
        source: 'browser' as const,
        id: `open-tab:browser:${result.pageId}`,
        title: result.title,
        matchedText: getMatchedText(result),
        worktreeId: result.worktreeId,
        contentType: 'browser' as const,
        pageId: result.pageId,
        workspaceId: result.workspaceId
      }
    }))
}

function rankSimulatorTabs(
  entries: readonly SearchableSimulatorTab[],
  query: string
): RankedResult[] {
  return searchSimulatorTabs([...entries], query)
    .filter((result) => !isNameOnlyMatch(result))
    .map((result) => ({
      tier: getTier(result),
      sourceRank: SOURCE_RANK.simulator,
      score: result.score,
      result: {
        source: 'simulator' as const,
        id: `open-tab:simulator:${result.tabId}`,
        title: result.title,
        matchedText: getMatchedText(result),
        worktreeId: result.worktreeId,
        contentType: 'simulator' as const,
        tabId: result.tabId,
        groupId: result.groupId
      }
    }))
}

export function searchOpenTabs({
  workspaceTabs,
  browserPages,
  simulatorTabs,
  query
}: OpenTabSearchInput): OpenTabSearchResult[] {
  const trimmed = query.trim()
  if (!trimmed || isOpenTabSearchQueryTooLarge(query)) {
    return []
  }

  return [
    ...rankWorkspaceTabs(workspaceTabs, trimmed),
    ...rankBrowserPages(browserPages, trimmed),
    ...rankSimulatorTabs(simulatorTabs, trimmed)
  ]
    .sort((a, b) => {
      if (a.tier !== b.tier) {
        return a.tier - b.tier
      }
      if (a.sourceRank !== b.sourceRank) {
        return a.sourceRank - b.sourceRank
      }
      return a.score - b.score
    })
    .slice(0, OPEN_TAB_SEARCH_RESULT_LIMIT)
    .map((ranked) => ranked.result)
}
