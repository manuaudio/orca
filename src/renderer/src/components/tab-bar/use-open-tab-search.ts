// Feeds the open-tab search module from the store for a single worktree, so the
// new-tab omnibox does not have to wire the twenty selectors the three builders need.

import { useDeferredValue, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Repo, Worktree } from '../../../../shared/types'
import { buildSearchableBrowserPages } from '@/lib/browser-palette-page-entries'
import type { SearchableBrowserPage } from '@/lib/browser-palette-search'
import {
  buildSearchableSimulatorTabs,
  type SearchableSimulatorTab
} from '@/lib/simulator-palette-search'
import {
  buildSearchableWorkspaceTabs,
  type SearchableWorkspaceTab
} from '@/lib/workspace-tab-palette-search'
import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { searchOpenTabs, type OpenTabSearchResult } from './open-tab-search'

const EMPTY_RESULTS: OpenTabSearchResult[] = []
const EMPTY_WORKSPACE_TABS: SearchableWorkspaceTab[] = []
const EMPTY_BROWSER_PAGES: SearchableBrowserPage[] = []
const EMPTY_SIMULATOR_TABS: SearchableSimulatorTab[] = []

type OpenTabSearchStoreSlice = Pick<
  AppState,
  | 'activeBrowserTabId'
  | 'activeFileId'
  | 'activeFileIdByWorktree'
  | 'activeGroupIdByWorktree'
  | 'activeTabId'
  | 'activeTabIdByWorktree'
  | 'activeTabType'
  | 'activeTabTypeByWorktree'
  | 'activeWorktreeId'
  | 'agentStatusByPaneKey'
  | 'browserPagesByWorkspace'
  | 'browserTabsByWorktree'
  | 'groupsByWorktree'
  | 'openFiles'
  | 'retainedAgentsByPaneKey'
  | 'sleepingAgentSessionsByPaneKey'
  | 'tabsByWorktree'
  | 'unifiedTabsByWorktree'
> & {
  worktree: Worktree | null
  repo: Repo | null
  generatedTitlesEnabled: boolean
}

// Why a shared constant: returning it while disabled keeps the shallow selector
// referentially stable, so a closed menu never re-renders on store churn.
const DISABLED_SLICE: OpenTabSearchStoreSlice = {
  activeBrowserTabId: null,
  activeFileId: null,
  activeFileIdByWorktree: {},
  activeGroupIdByWorktree: {},
  activeTabId: null,
  activeTabIdByWorktree: {},
  activeTabType: 'terminal',
  activeTabTypeByWorktree: {},
  activeWorktreeId: null,
  agentStatusByPaneKey: {},
  browserPagesByWorkspace: {},
  browserTabsByWorktree: {},
  groupsByWorktree: {},
  openFiles: [],
  retainedAgentsByPaneKey: {},
  sleepingAgentSessionsByPaneKey: {},
  tabsByWorktree: {},
  unifiedTabsByWorktree: {},
  worktree: null,
  repo: null,
  generatedTitlesEnabled: false
}

export type UseOpenTabSearchOptions = {
  enabled: boolean
  groupId: string
  query: string
  worktreeId: string
}

function selectOpenTabSearchSlice(
  state: AppState,
  enabled: boolean,
  worktreeId: string
): OpenTabSearchStoreSlice {
  if (!enabled) {
    return DISABLED_SLICE
  }
  // Why getKnownWorktreeById: folder workspaces are absent from worktreesByRepo.
  const worktree = state.getKnownWorktreeById(worktreeId) ?? null
  return {
    activeBrowserTabId: state.activeBrowserTabId,
    activeFileId: state.activeFileId,
    activeFileIdByWorktree: state.activeFileIdByWorktree,
    activeGroupIdByWorktree: state.activeGroupIdByWorktree,
    activeTabId: state.activeTabId,
    activeTabIdByWorktree: state.activeTabIdByWorktree,
    activeTabType: state.activeTabType,
    activeTabTypeByWorktree: state.activeTabTypeByWorktree,
    activeWorktreeId: state.activeWorktreeId,
    agentStatusByPaneKey: state.agentStatusByPaneKey,
    browserPagesByWorkspace: state.browserPagesByWorkspace,
    browserTabsByWorktree: state.browserTabsByWorktree,
    groupsByWorktree: state.groupsByWorktree,
    openFiles: state.openFiles,
    retainedAgentsByPaneKey: state.retainedAgentsByPaneKey,
    sleepingAgentSessionsByPaneKey: state.sleepingAgentSessionsByPaneKey,
    tabsByWorktree: state.tabsByWorktree,
    unifiedTabsByWorktree: state.unifiedTabsByWorktree,
    worktree,
    repo: worktree ? (state.repos.find((repo) => repo.id === worktree.repoId) ?? null) : null,
    generatedTitlesEnabled: state.settings?.tabAutoGenerateTitle === true
  }
}

// The tab the "+" column is showing. R4 cannot rely on the engines' current-tab
// flags alone: those track the focused group, and "+" can be clicked in another.
function getVisibleColumnTabId(
  groups: readonly { id: string; activeTabId: string | null }[],
  groupId: string
): string | null {
  return groups.find((group) => group.id === groupId)?.activeTabId ?? null
}

export function useOpenTabSearch({
  enabled,
  groupId,
  query,
  worktreeId
}: UseOpenTabSearchOptions): OpenTabSearchResult[] {
  const slice = useAppStore(
    useShallow((state: AppState) => selectOpenTabSearchSlice(state, enabled, worktreeId))
  )
  const deferredQuery = useDeferredValue(query)

  const worktrees = useMemo(() => (slice.worktree ? [slice.worktree] : []), [slice.worktree])
  const repoMap = useMemo(
    () => new Map(slice.repo ? [[slice.repo.id, { displayName: slice.repo.displayName }]] : []),
    [slice.repo]
  )
  const worktreeOrder = useMemo(
    () => new Map(worktrees.map((worktree, index) => [worktree.id, index])),
    [worktrees]
  )

  const visibleTabId = useMemo(
    () => getVisibleColumnTabId(slice.groupsByWorktree[worktreeId] ?? [], groupId),
    [groupId, slice.groupsByWorktree, worktreeId]
  )
  const visibleBrowserWorkspaceId = useMemo(() => {
    const visibleTab = (slice.unifiedTabsByWorktree[worktreeId] ?? []).find(
      (tab) => tab.id === visibleTabId
    )
    return visibleTab?.contentType === 'browser' ? visibleTab.entityId : null
  }, [slice.unifiedTabsByWorktree, visibleTabId, worktreeId])

  const workspaceTabs = useMemo(
    () =>
      !enabled
        ? EMPTY_WORKSPACE_TABS
        : buildSearchableWorkspaceTabs({
            worktrees,
            repoMap,
            worktreeOrder,
            unifiedTabsByWorktree: slice.unifiedTabsByWorktree,
            tabsByWorktree: slice.tabsByWorktree,
            openFiles: slice.openFiles,
            agentStatusByPaneKey: slice.agentStatusByPaneKey,
            retainedAgentsByPaneKey: slice.retainedAgentsByPaneKey,
            sleepingAgentSessionsByPaneKey: slice.sleepingAgentSessionsByPaneKey,
            activeGroupIdByWorktree: slice.activeGroupIdByWorktree,
            groupsByWorktree: slice.groupsByWorktree,
            activeWorktreeId: slice.activeWorktreeId,
            activeTabType: slice.activeTabType,
            activeTabId: slice.activeTabId,
            activeTabIdByWorktree: slice.activeTabIdByWorktree,
            activeFileId: slice.activeFileId,
            activeFileIdByWorktree: slice.activeFileIdByWorktree,
            activeTabTypeByWorktree: slice.activeTabTypeByWorktree,
            generatedTitlesEnabled: slice.generatedTitlesEnabled
          }).filter((entry) => entry.tab.id !== visibleTabId),
    [
      enabled,
      repoMap,
      slice.activeFileId,
      slice.activeFileIdByWorktree,
      slice.activeGroupIdByWorktree,
      slice.activeTabId,
      slice.activeTabIdByWorktree,
      slice.activeTabType,
      slice.activeTabTypeByWorktree,
      slice.activeWorktreeId,
      slice.agentStatusByPaneKey,
      slice.generatedTitlesEnabled,
      slice.groupsByWorktree,
      slice.openFiles,
      slice.retainedAgentsByPaneKey,
      slice.sleepingAgentSessionsByPaneKey,
      slice.tabsByWorktree,
      slice.unifiedTabsByWorktree,
      visibleTabId,
      worktreeOrder,
      worktrees
    ]
  )

  const browserPages = useMemo(
    () =>
      !enabled
        ? EMPTY_BROWSER_PAGES
        : buildSearchableBrowserPages({
            worktrees,
            repoMap,
            worktreeOrder,
            browserTabsByWorktree: slice.browserTabsByWorktree,
            browserPagesByWorkspace: slice.browserPagesByWorkspace,
            activeBrowserTabId: slice.activeBrowserTabId,
            activeWorktreeId: slice.activeWorktreeId,
            activeTabType: slice.activeTabType
          }).filter(
            (entry) =>
              entry.workspace.id !== visibleBrowserWorkspaceId ||
              entry.page.id !== entry.workspace.activePageId
          ),
    [
      enabled,
      repoMap,
      slice.activeBrowserTabId,
      slice.activeTabType,
      slice.activeWorktreeId,
      slice.browserPagesByWorkspace,
      slice.browserTabsByWorktree,
      visibleBrowserWorkspaceId,
      worktreeOrder,
      worktrees
    ]
  )

  const simulatorTabs = useMemo(
    () =>
      !enabled
        ? EMPTY_SIMULATOR_TABS
        : buildSearchableSimulatorTabs({
            worktrees,
            repoMap,
            worktreeOrder,
            unifiedTabsByWorktree: slice.unifiedTabsByWorktree,
            activeGroupIdByWorktree: slice.activeGroupIdByWorktree,
            groupsByWorktree: slice.groupsByWorktree,
            activeWorktreeId: slice.activeWorktreeId,
            activeTabType: slice.activeTabType
          }).filter((entry) => entry.tab.id !== visibleTabId),
    [
      enabled,
      repoMap,
      slice.activeGroupIdByWorktree,
      slice.activeTabType,
      slice.activeWorktreeId,
      slice.groupsByWorktree,
      slice.unifiedTabsByWorktree,
      visibleTabId,
      worktreeOrder,
      worktrees
    ]
  )

  return useMemo(() => {
    if (!enabled) {
      return EMPTY_RESULTS
    }
    return searchOpenTabs({ workspaceTabs, browserPages, simulatorTabs, query: deferredQuery })
  }, [browserPages, deferredQuery, enabled, simulatorTabs, workspaceTabs])
}
