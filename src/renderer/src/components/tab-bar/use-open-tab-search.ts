// Feeds the open-tab search module from the store for a single worktree.

import { useDeferredValue, useMemo } from 'react'
import { useAppStore } from '@/store'
import { buildOpenTabSearchEntries } from './open-tab-search-entries'
import { searchOpenTabs, type OpenTabSearchResult } from './open-tab-search'

const EMPTY_RESULTS: OpenTabSearchResult[] = []

export type UseOpenTabSearchOptions = {
  enabled: boolean
  query: string
  worktreeId: string
}

export function useOpenTabSearch({
  enabled,
  query,
  worktreeId
}: UseOpenTabSearchOptions): OpenTabSearchResult[] {
  // Why a snapshot taken at open instead of a store subscription: the menu is
  // short-lived, so the tab set cannot meaningfully change while it is up, and
  // subscribing would re-render a closed menu on unrelated store churn.
  const entries = useMemo(
    () => (enabled ? buildOpenTabSearchEntries(useAppStore.getState(), worktreeId) : null),
    [enabled, worktreeId]
  )
  const deferredQuery = useDeferredValue(query)

  return useMemo(
    () => (entries ? searchOpenTabs({ ...entries, query: deferredQuery }) : EMPTY_RESULTS),
    [deferredQuery, entries]
  )
}
