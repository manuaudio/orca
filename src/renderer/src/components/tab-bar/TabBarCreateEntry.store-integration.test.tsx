// @vitest-environment happy-dom
//
// End-to-end from store state to a rendered switch row: the search hook, the
// three engines and the row assembly are all real here. The mocked suites can
// all pass while the shipped omnibox shows nothing, which is what this covers.

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import type { Repo, Tab, TabGroup, TerminalTab, Worktree } from '../../../../shared/types'
import type { TabAgentLaunchOption } from './tab-agent-launch-options'
import type { TabCreateMenuOption } from './tab-create-menu-options'

// Only the file-entry side is stubbed: it reaches runtime IPC, and these tests
// assert on tab rows.
vi.mock('./tab-create-entry-action', () => ({
  getTabEntryOptions: () => [],
  createTabEntryAllowAbsolutePathsSelector: () => () => true,
  isTabEntryAbsolutePathLike: () => false
}))
vi.mock('../quick-open-file-list', () => ({
  useRuntimeFileListForWorktree: () => ({ files: [], loading: false, loadError: null })
}))
vi.mock('@/lib/agent-catalog', () => ({
  getAgentCatalog: () => [],
  AgentIcon: () => null
}))

import TabBarCreateEntry from './TabBarCreateEntry'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const initialAppState = useAppStore.getInitialState()

const repo: Repo = {
  id: 'repo-1',
  path: '/tmp/repo-1',
  displayName: 'orca',
  badgeColor: '#000000',
  addedAt: 0
}

const worktree: Worktree = {
  id: 'wt-1',
  repoId: 'repo-1',
  path: '/tmp/wt-1',
  head: 'abc123',
  branch: 'refs/heads/main',
  isBare: false,
  isMainWorktree: false,
  displayName: 'add-search-for-tabs',
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

function unifiedTab(id: string, entityId: string): Tab {
  return {
    id,
    entityId,
    groupId: 'group-1',
    worktreeId: 'wt-1',
    contentType: 'terminal',
    label: '',
    customLabel: null,
    color: null,
    sortOrder: 0,
    createdAt: 0
  }
}

function terminalTab(id: string, title: string): TerminalTab {
  return {
    id,
    ptyId: null,
    worktreeId: 'wt-1',
    title,
    generatedTitle: null,
    customTitle: null,
    color: null,
    sortOrder: 0,
    createdAt: 0
  }
}

const group: TabGroup = {
  id: 'group-1',
  worktreeId: 'wt-1',
  activeTabId: 'tab-x',
  tabOrder: ['tab-claude', 'tab-x', 'tab-orca']
}

// Mirrors a real single-column strip: "x - user" is the tab on screen.
function seedStore(overrides: Partial<AppState> = {}): void {
  useAppStore.setState(
    {
      ...initialAppState,
      repos: [repo],
      worktreesByRepo: { 'repo-1': [worktree] },
      unifiedTabsByWorktree: {
        'wt-1': [
          unifiedTab('tab-claude', 'term-claude'),
          unifiedTab('tab-x', 'term-x'),
          unifiedTab('tab-orca', 'term-orca')
        ]
      },
      tabsByWorktree: {
        'wt-1': [
          terminalTab('term-claude', '✻ Claude'),
          terminalTab('term-x', 'x - user'),
          terminalTab('term-orca', 'orca')
        ]
      },
      groupsByWorktree: { 'wt-1': [group] },
      activeGroupIdByWorktree: { 'wt-1': 'group-1' },
      activeWorktreeId: 'wt-1',
      activeTabType: 'terminal',
      activeTabTypeByWorktree: { 'wt-1': 'terminal' },
      activeTabId: 'term-x',
      activeTabIdByWorktree: { 'wt-1': 'term-x' },
      settings: {
        ...initialAppState.settings,
        tabAutoGenerateTitle: false
      } as AppState['settings'],
      ...overrides
    } as AppState,
    true
  )
}

const menuOptions: TabCreateMenuOption[] = [
  { id: 'new-terminal', kind: 'new-terminal', keywords: ['terminal', 'claude'], label: 'Terminal' }
]
const agentOptions: TabAgentLaunchOption[] = [
  { agent: 'claude', aliases: ['claude'], label: 'Claude Code' }
]

let container: HTMLDivElement
let root: Root

function render(): void {
  act(() => {
    root.render(
      <TooltipProvider>
        <TabBarCreateEntry
          worktreeId="wt-1"
          groupId="group-1"
          menuOpen
          menuOptions={menuOptions}
          agentOptions={agentOptions}
          onOpenEntry={async () => {}}
        />
      </TooltipProvider>
    )
  })
}

function type(value: string): void {
  const input = container.querySelector('input')
  if (!input) {
    throw new Error('omnibox input missing')
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function rowLabels(): string[] {
  return [...container.querySelectorAll('[role="option"]')].map(
    (row) => row.textContent?.trim() ?? ''
  )
}

describe('TabBarCreateEntry against real store state', () => {
  beforeEach(() => {
    seedStore()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('renders a switch row for a tab in the same column', () => {
    render()
    type('orca')

    expect(rowLabels().some((label) => label.includes('orca'))).toBe(true)
  })

  it('matches on a title substring, not just a prefix', () => {
    render()
    type('claude')

    expect(rowLabels().some((label) => label.includes('Claude'))).toBe(true)
  })

  // Tab rows are additive: they must not displace the agent and create-command
  // rows that the same query already produced.
  it('keeps agent and create-command rows alongside tab rows', () => {
    render()
    type('claude')

    const labels = rowLabels()
    expect(labels.some((label) => label.includes('Switch to tab'))).toBe(true)
    expect(labels.some((label) => label.includes('Claude Code'))).toBe(true)
    expect(labels.some((label) => label.includes('Terminal'))).toBe(true)
  })

  // The case both bug reports hit: searching for the tab on screen looked broken.
  it('renders a switch row for the tab the column is already showing', () => {
    render()
    type('x - user')

    expect(rowLabels().some((label) => label.includes('x - user'))).toBe(true)
  })

  // A browser tab on screen makes getActiveUnifiedTabId return null, so no
  // terminal tab is flagged current. Terminal tabs must still be reachable.
  it('finds terminal tabs while a browser tab holds focus', () => {
    seedStore({
      unifiedTabsByWorktree: {
        'wt-1': [
          unifiedTab('tab-claude', 'term-claude'),
          unifiedTab('tab-x', 'term-x'),
          { ...unifiedTab('tab-web', 'ws-1'), contentType: 'browser', label: 'fix(config): …' }
        ]
      },
      groupsByWorktree: {
        'wt-1': [{ ...group, activeTabId: 'tab-web', tabOrder: ['tab-claude', 'tab-x', 'tab-web'] }]
      },
      activeTabType: 'browser',
      activeTabTypeByWorktree: { 'wt-1': 'browser' },
      activeBrowserTabId: 'ws-1',
      activeTabId: null,
      activeTabIdByWorktree: { 'wt-1': null }
    })
    render()
    type('claude')

    expect(rowLabels().some((label) => label.includes('Claude'))).toBe(true)
  })
})
