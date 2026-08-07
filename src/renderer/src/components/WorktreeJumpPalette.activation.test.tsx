// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ReactI18Next from 'react-i18next'
import { toast } from 'sonner'
import type {
  BrowserPage,
  BrowserWorkspace,
  Repo,
  Tab,
  TabGroup,
  Worktree
} from '../../../shared/types'
import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { ORCA_BROWSER_FOCUS_REQUEST_EVENT } from '@/components/browser-pane/browser-focus'
import { activateBrowserPagePaletteResult } from '@/lib/browser-page-palette-activation'
import { activateSimulatorTabPaletteResult } from '@/lib/simulator-tab-palette-activation'
import WorktreeJumpPalette from './WorktreeJumpPalette'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactI18Next>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback?: string) => fallback ?? _key
    })
  }
})

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    message: vi.fn()
  }
}))

vi.mock('@/hooks/useSettingsNavigationMetadata', () => ({
  useSettingsNavigationMetadata: () => []
}))

vi.mock('@/components/sidebar/StatusIndicator', () => ({
  default: () => <span data-status-indicator="true" />
}))

vi.mock('@/components/repo/RepoBadgeLabel', () => ({
  RepoBadgeMark: () => <span data-repo-badge-mark="true" />
}))

vi.mock('@/components/cmd-j/palette-host-badge', () => ({
  getPaletteHostBadge: () => null
}))

vi.mock('@/lib/browser-page-palette-activation', () => ({
  activateBrowserPagePaletteResult: vi.fn()
}))

vi.mock('@/lib/simulator-tab-palette-activation', () => ({
  activateSimulatorTabPaletteResult: vi.fn()
}))

vi.mock('@/components/ui/command', async () => {
  const React = await import('react')
  return {
    CommandDialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
      open ? <div data-command-dialog="true">{children}</div> : null,
    CommandInput: ({
      value,
      onValueChange
    }: {
      value?: string
      onValueChange?: (next: string) => void
    }) => {
      setCommandQuery = onValueChange ?? null
      return <input data-command-input="true" value={value} onChange={() => {}} />
    },
    CommandList: React.forwardRef(function CommandList(
      { children }: { children: React.ReactNode },
      ref: React.ForwardedRef<HTMLDivElement>
    ) {
      return (
        <div ref={ref} data-command-list="true">
          {children}
        </div>
      )
    }),
    CommandEmpty: ({ children }: { children: React.ReactNode }) => (
      <div data-command-empty="true">{children}</div>
    ),
    CommandItem: ({
      children,
      onSelect,
      value
    }: {
      children: React.ReactNode
      onSelect?: (value: string) => void
      value?: string
    }) => (
      <button data-command-item={value ?? ''} onClick={() => onSelect?.(value ?? '')} type="button">
        {children}
      </button>
    )
  }
})

const activateBrowserPage = vi.mocked(activateBrowserPagePaletteResult)
const activateSimulatorTab = vi.mocked(activateSimulatorTabPaletteResult)
const initialAppState = useAppStore.getInitialState()
let testRoot: Root
let testContainer: HTMLDivElement
let setCommandQuery: ((next: string) => void) | null = null

function makeRepo(): Repo {
  return {
    id: 'repo-1',
    path: '/repos/repo-1',
    displayName: 'Repo 1',
    badgeColor: '#000000',
    addedAt: 0
  }
}

function makeWorktree(): Worktree {
  return {
    id: 'wt-1',
    repoId: 'repo-1',
    path: '/tmp/wt-1',
    head: 'abc123',
    branch: 'refs/heads/main',
    isBare: false,
    isMainWorktree: false,
    displayName: 'Palette Worktree',
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

function makeWorkspace(): BrowserWorkspace {
  return {
    id: 'ws-1',
    worktreeId: 'wt-1',
    activePageId: 'page-1',
    pageIds: ['page-1'],
    url: 'https://example.com/docs',
    title: 'Docs',
    loading: false,
    faviconUrl: null,
    canGoBack: false,
    canGoForward: false,
    loadError: null,
    createdAt: 0
  }
}

function makePage(): BrowserPage {
  return {
    id: 'page-1',
    workspaceId: 'ws-1',
    worktreeId: 'wt-1',
    url: 'https://example.com/docs',
    title: 'Zebra Docs',
    loading: false,
    faviconUrl: null,
    canGoBack: false,
    canGoForward: false,
    loadError: null,
    createdAt: 0
  }
}

function makeSimulatorTab(): Tab {
  return {
    id: 'sim-tab-1',
    entityId: 'sim-1',
    groupId: 'group-1',
    worktreeId: 'wt-1',
    contentType: 'simulator',
    label: 'Zebra Emulator',
    customLabel: null,
    color: null,
    sortOrder: 0,
    createdAt: 0
  }
}

function makeGroup(): TabGroup {
  return {
    id: 'group-1',
    worktreeId: 'wt-1',
    activeTabId: null,
    tabOrder: ['sim-tab-1']
  }
}

async function flushEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function renderPaletteWithQuery(query: string): Promise<void> {
  useAppStore.setState({
    activeModal: 'worktree-palette',
    activeWorktreeId: 'wt-1',
    activeTabType: 'terminal',
    repos: [makeRepo()],
    worktreesByRepo: { 'repo-1': [makeWorktree()] },
    tabsByWorktree: {},
    browserTabsByWorktree: { 'wt-1': [makeWorkspace()] },
    browserPagesByWorkspace: { 'ws-1': [makePage()] },
    unifiedTabsByWorktree: { 'wt-1': [makeSimulatorTab()] },
    groupsByWorktree: { 'wt-1': [makeGroup()] },
    activeGroupIdByWorktree: { 'wt-1': 'group-1' },
    lastVisitedAtByWorktreeId: {}
  } as Partial<AppState>)

  await act(async () => {
    testRoot.render(<WorktreeJumpPalette />)
  })
  await flushEffects()
  await act(async () => {
    setCommandQuery?.(query)
  })
  await flushEffects()
}

function clickRow(itemId: string): void {
  const row = testContainer.querySelector<HTMLButtonElement>(`[data-command-item="${itemId}"]`)
  expect(row, `expected palette row ${itemId}`).not.toBeNull()
  act(() => {
    row?.click()
  })
}

describe('WorktreeJumpPalette open-tab activation', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    vi.clearAllMocks()
    setCommandQuery = null
    useAppStore.setState(initialAppState, true)
    testContainer = document.createElement('div')
    document.body.appendChild(testContainer)
    testRoot = createRoot(testContainer)
  })

  afterEach(async () => {
    await act(async () => {
      testRoot.unmount()
    })
    document.body.replaceChildren()
    useAppStore.setState(initialAppState, true)
  })

  it('delegates a browser page row to the activation module and focuses the page', async () => {
    activateBrowserPage.mockReturnValue({
      status: 'activated',
      pageId: 'page-1',
      focusTarget: 'address-bar'
    })
    const focusRequests: CustomEvent[] = []
    const onFocusRequest = (event: Event): void => {
      focusRequests.push(event as CustomEvent)
    }
    window.addEventListener(ORCA_BROWSER_FOCUS_REQUEST_EVENT, onFocusRequest)

    await renderPaletteWithQuery('zebra')
    clickRow('browser-page:page-1')

    window.removeEventListener(ORCA_BROWSER_FOCUS_REQUEST_EVENT, onFocusRequest)
    expect(activateBrowserPage).toHaveBeenCalledWith(
      expect.objectContaining({
        pageId: 'page-1',
        workspaceId: 'ws-1',
        worktreeId: 'wt-1'
      })
    )
    expect(useAppStore.getState().activeModal).toBe('none')
    expect(focusRequests.map((event) => event.detail)).toEqual([
      { pageId: 'page-1', target: 'address-bar' }
    ])
  })

  it('surfaces each browser failure reason as its own toast and keeps the palette open', async () => {
    activateBrowserPage.mockReturnValue({
      status: 'failed',
      reason: 'missing-page'
    })
    await renderPaletteWithQuery('zebra')
    clickRow('browser-page:page-1')

    expect(toast.error).toHaveBeenCalledWith('Browser page no longer exists')
    expect(useAppStore.getState().activeModal).toBe('worktree-palette')

    activateBrowserPage.mockReturnValue({
      status: 'failed',
      reason: 'missing-worktree'
    })
    clickRow('browser-page:page-1')

    expect(toast.error).toHaveBeenLastCalledWith('Workspace no longer exists')
    expect(useAppStore.getState().activeModal).toBe('worktree-palette')
  })

  it('delegates a simulator tab row to the activation module and closes the palette', async () => {
    activateSimulatorTab.mockReturnValue({
      status: 'activated',
      tabId: 'sim-tab-1'
    })

    await renderPaletteWithQuery('zebra')
    clickRow('simulator-tab:sim-tab-1')

    expect(activateSimulatorTab).toHaveBeenCalledWith(
      expect.objectContaining({ tabId: 'sim-tab-1', worktreeId: 'wt-1' })
    )
    expect(useAppStore.getState().activeModal).toBe('none')
  })

  it('surfaces each simulator failure reason as its own toast and keeps the palette open', async () => {
    activateSimulatorTab.mockReturnValue({
      status: 'failed',
      reason: 'missing-tab'
    })
    await renderPaletteWithQuery('zebra')
    clickRow('simulator-tab:sim-tab-1')

    expect(toast.error).toHaveBeenCalledWith('Mobile emulator tab no longer exists')
    expect(useAppStore.getState().activeModal).toBe('worktree-palette')

    activateSimulatorTab.mockReturnValue({
      status: 'failed',
      reason: 'missing-worktree'
    })
    clickRow('simulator-tab:sim-tab-1')

    expect(toast.error).toHaveBeenLastCalledWith('Workspace no longer exists')
    expect(useAppStore.getState().activeModal).toBe('worktree-palette')
  })
})
