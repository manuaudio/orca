// @vitest-environment happy-dom

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  BrowserPage,
  BrowserWorkspace,
  Repo,
  Tab,
  TabContentType,
  TabGroup,
  TerminalTab,
  Worktree
} from '../../../../shared/types'
import type * as BrowserPalettePageEntries from '@/lib/browser-palette-page-entries'
import type * as SimulatorPaletteSearch from '@/lib/simulator-palette-search'
import type * as WorkspaceTabPaletteSearch from '@/lib/workspace-tab-palette-search'
import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'

const mocks = vi.hoisted(() => ({
  buildWorkspaceTabs: vi.fn(),
  buildBrowserPages: vi.fn(),
  buildSimulatorTabs: vi.fn()
}))

vi.mock('@/lib/workspace-tab-palette-search', async (importOriginal) => {
  const actual = await importOriginal<typeof WorkspaceTabPaletteSearch>()
  mocks.buildWorkspaceTabs.mockImplementation(actual.buildSearchableWorkspaceTabs)
  return { ...actual, buildSearchableWorkspaceTabs: mocks.buildWorkspaceTabs }
})

vi.mock('@/lib/browser-palette-page-entries', async (importOriginal) => {
  const actual = await importOriginal<typeof BrowserPalettePageEntries>()
  mocks.buildBrowserPages.mockImplementation(actual.buildSearchableBrowserPages)
  return { ...actual, buildSearchableBrowserPages: mocks.buildBrowserPages }
})

vi.mock('@/lib/simulator-palette-search', async (importOriginal) => {
  const actual = await importOriginal<typeof SimulatorPaletteSearch>()
  mocks.buildSimulatorTabs.mockImplementation(actual.buildSearchableSimulatorTabs)
  return { ...actual, buildSearchableSimulatorTabs: mocks.buildSimulatorTabs }
})

import { useOpenTabSearch } from './use-open-tab-search'

const initialAppState = useAppStore.getInitialState()

function makeWorktree(id: string, displayName: string): Worktree {
  return {
    id,
    repoId: 'repo-1',
    path: `/tmp/${id}`,
    head: 'abc123',
    branch: 'refs/heads/main',
    isBare: false,
    isMainWorktree: false,
    displayName,
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 0
  }
}

const repo: Repo = {
  id: 'repo-1',
  path: '/tmp/repo-1',
  displayName: 'octo/rocket',
  badgeColor: '#000000',
  addedAt: 0
}

function makeUnifiedTab({
  id,
  entityId,
  groupId,
  worktreeId = 'wt-1',
  contentType = 'terminal',
  label = ''
}: {
  id: string
  entityId: string
  groupId: string
  worktreeId?: string
  contentType?: TabContentType
  label?: string
}): Tab {
  return {
    id,
    entityId,
    groupId,
    worktreeId,
    contentType,
    label,
    customLabel: null,
    color: null,
    sortOrder: 0,
    createdAt: 0
  }
}

function makeTerminalTab({
  id,
  title,
  worktreeId = 'wt-1',
  generatedTitle = null
}: {
  id: string
  title: string
  worktreeId?: string
  generatedTitle?: string | null
}): TerminalTab {
  return {
    id,
    ptyId: null,
    worktreeId,
    title,
    generatedTitle,
    customTitle: null,
    color: null,
    sortOrder: 0,
    createdAt: 0
  }
}

function makeGroup(id: string, activeTabId: string | null, tabOrder: string[]): TabGroup {
  return { id, worktreeId: 'wt-1', activeTabId, tabOrder }
}

const browserWorkspace: BrowserWorkspace = {
  id: 'ws-1',
  worktreeId: 'wt-1',
  activePageId: 'page-1',
  pageIds: ['page-1'],
  url: 'https://example.com',
  title: 'zebra page',
  loading: false,
  faviconUrl: null,
  canGoBack: false,
  canGoForward: false,
  loadError: null,
  createdAt: 0
}

const browserPage: BrowserPage = {
  id: 'page-1',
  workspaceId: 'ws-1',
  worktreeId: 'wt-1',
  url: 'https://example.com/page',
  title: 'zebra page',
  loading: false,
  faviconUrl: null,
  canGoBack: false,
  canGoForward: false,
  loadError: null,
  createdAt: 0
}

// wt-1 spans two columns: group-1 shows tab-a, group-2 shows tab-c.
function seedStore(overrides: Partial<AppState> = {}): void {
  useAppStore.setState(
    {
      ...initialAppState,
      repos: [repo],
      worktreesByRepo: {
        'repo-1': [makeWorktree('wt-1', 'Aurora Workspace'), makeWorktree('wt-2', 'Nebula')]
      },
      unifiedTabsByWorktree: {
        'wt-1': [
          makeUnifiedTab({ id: 'tab-a', entityId: 'term-a', groupId: 'group-1' }),
          makeUnifiedTab({ id: 'tab-b', entityId: 'term-b', groupId: 'group-1' }),
          makeUnifiedTab({ id: 'tab-c', entityId: 'term-c', groupId: 'group-2' }),
          makeUnifiedTab({
            id: 'tab-browser',
            entityId: 'ws-1',
            groupId: 'group-2',
            contentType: 'browser',
            label: 'zebra page'
          }),
          makeUnifiedTab({
            id: 'tab-sim',
            entityId: 'sim-1',
            groupId: 'group-2',
            contentType: 'simulator',
            label: 'zebra sim'
          })
        ],
        'wt-2': [
          makeUnifiedTab({
            id: 'tab-d',
            entityId: 'term-d',
            groupId: 'group-3',
            worktreeId: 'wt-2'
          })
        ]
      },
      tabsByWorktree: {
        'wt-1': [
          makeTerminalTab({ id: 'term-a', title: 'zebra alpha' }),
          makeTerminalTab({ id: 'term-b', title: 'zebra beta' }),
          makeTerminalTab({ id: 'term-c', title: 'zebra gamma' })
        ],
        'wt-2': [makeTerminalTab({ id: 'term-d', title: 'zebra delta', worktreeId: 'wt-2' })]
      },
      groupsByWorktree: {
        'wt-1': [
          makeGroup('group-1', 'tab-a', ['tab-a', 'tab-b']),
          makeGroup('group-2', 'tab-c', ['tab-c', 'tab-browser', 'tab-sim'])
        ],
        'wt-2': [{ id: 'group-3', worktreeId: 'wt-2', activeTabId: 'tab-d', tabOrder: ['tab-d'] }]
      },
      browserTabsByWorktree: { 'wt-1': [browserWorkspace] },
      browserPagesByWorkspace: { 'ws-1': [browserPage] },
      activeGroupIdByWorktree: { 'wt-1': 'group-1', 'wt-2': 'group-3' },
      activeWorktreeId: 'wt-1',
      settings: {
        ...initialAppState.settings,
        tabAutoGenerateTitle: false
      } as AppState['settings'],
      ...overrides
    } as AppState,
    true
  )
}

function renderSearch(options: { enabled?: boolean; groupId?: string; query?: string } = {}) {
  return renderHook(
    (props: { enabled: boolean; groupId: string; query: string }) =>
      useOpenTabSearch({ ...props, worktreeId: 'wt-1' }),
    {
      initialProps: {
        enabled: options.enabled ?? true,
        groupId: options.groupId ?? 'group-1',
        query: options.query ?? 'zebra'
      }
    }
  )
}

describe('useOpenTabSearch', () => {
  beforeEach(() => {
    mocks.buildWorkspaceTabs.mockClear()
    mocks.buildBrowserPages.mockClear()
    mocks.buildSimulatorTabs.mockClear()
    seedStore()
  })

  it('returns no results and builds no entries while disabled', () => {
    const { result } = renderSearch({ enabled: false })

    expect(result.current).toEqual([])
    expect(mocks.buildWorkspaceTabs).not.toHaveBeenCalled()
    expect(mocks.buildBrowserPages).not.toHaveBeenCalled()
    expect(mocks.buildSimulatorTabs).not.toHaveBeenCalled()
  })

  it('returns only tabs from the requested worktree', () => {
    const { result } = renderSearch()

    expect(result.current.map((entry) => entry.title)).not.toContain('zebra delta')
    expect(result.current.every((entry) => entry.worktreeId === 'wt-1')).toBe(true)
  })

  it('includes tabs from every column of the worktree, not just the focused one', () => {
    const { result } = renderSearch()

    // tab-a is group-1's visible tab; everything else across both columns matches.
    expect(result.current.map((entry) => entry.title)).toEqual([
      'zebra beta',
      'zebra gamma',
      'zebra page',
      'zebra sim'
    ])
  })

  it('excludes the visible tab of the column the menu was opened from', () => {
    const { result } = renderSearch({ groupId: 'group-2' })

    const titles = result.current.map((entry) => entry.title)
    expect(titles).toContain('zebra alpha')
    expect(titles).not.toContain('zebra gamma')
  })

  it('rebuilds entries when tabs change but not when only the query changes', () => {
    const { rerender } = renderSearch()
    const buildsAfterMount = mocks.buildWorkspaceTabs.mock.calls.length

    rerender({ enabled: true, groupId: 'group-1', query: 'zebra b' })
    expect(mocks.buildWorkspaceTabs.mock.calls.length).toBe(buildsAfterMount)

    useAppStore.setState({
      tabsByWorktree: {
        ...useAppStore.getState().tabsByWorktree,
        'wt-1': [
          ...(useAppStore.getState().tabsByWorktree['wt-1'] ?? []),
          makeTerminalTab({ id: 'term-e', title: 'zebra epsilon' })
        ]
      }
    })
    rerender({ enabled: true, groupId: 'group-1', query: 'zebra b' })
    expect(mocks.buildWorkspaceTabs.mock.calls.length).toBeGreaterThan(buildsAfterMount)
  })

  it('reflects the generated-titles setting in matched titles', () => {
    seedStore({
      tabsByWorktree: {
        'wt-1': [makeTerminalTab({ id: 'term-a', title: '', generatedTitle: 'zebra generated' })]
      },
      settings: {
        ...initialAppState.settings,
        tabAutoGenerateTitle: true
      } as AppState['settings']
    })

    const { result } = renderSearch({ groupId: 'group-2', query: 'generated' })
    expect(result.current.map((entry) => entry.title)).toEqual(['zebra generated'])

    seedStore({
      tabsByWorktree: {
        'wt-1': [makeTerminalTab({ id: 'term-a', title: '', generatedTitle: 'zebra generated' })]
      }
    })
    const disabled = renderSearch({ groupId: 'group-2', query: 'generated' })
    expect(disabled.result.current).toEqual([])
  })
})
