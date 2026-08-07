// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  authStatus: {
    activeProfileId: 'profile-a',
    cloud: { cloudProfileId: 'cloud-a', userId: 'user-a' },
    configured: true,
    state: 'connected'
  } as Record<string, unknown>,
  closePage: vi.fn(),
  connect: vi.fn(),
  confirm: vi.fn(),
  refreshAuth: vi.fn(),
  rpc: vi.fn(),
  resolvePartition: vi.fn(),
  writeClipboardText: vi.fn(),
  openUrl: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn()
}))

vi.mock('sonner', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError }
}))

vi.mock('@/components/confirmation-dialog-context', () => ({
  useConfirmationDialog: () => mocks.confirm
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <div>{children}</div>
}))

vi.mock('@/runtime/runtime-rpc-client', () => ({
  callRuntimeRpc: mocks.rpc
}))

vi.mock('@/store', () => ({
  useAppStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) => selector(storeState()),
    { getState: storeState }
  )
}))

function storeState(): Record<string, unknown> {
  return {
    closeArtifactsPage: mocks.closePage,
    connectCurrentOrcaProfile: mocks.connect,
    orcaProfileAuthStatus: mocks.authStatus,
    orcaProfileConnecting: false,
    refreshCurrentOrcaProfileAuth: mocks.refreshAuth
  }
}

import ArtifactsPage from './ArtifactsPage'

describe('ArtifactsPage', () => {
  beforeEach(() => {
    mocks.authStatus = {
      activeProfileId: 'profile-a',
      cloud: { cloudProfileId: 'cloud-a', userId: 'user-a' },
      configured: true,
      state: 'connected'
    }
    mocks.closePage.mockReset()
    mocks.connect.mockReset()
    mocks.confirm.mockReset()
    mocks.refreshAuth.mockReset()
    mocks.rpc.mockReset()
    mocks.resolvePartition.mockReset().mockResolvedValue('persist:orca-default')
    mocks.writeClipboardText.mockReset().mockResolvedValue(undefined)
    mocks.openUrl.mockReset().mockResolvedValue(undefined)
    mocks.toastSuccess.mockReset()
    mocks.toastError.mockReset()
    Object.assign(window, {
      api: {
        browser: { sessionResolvePartition: mocks.resolvePartition },
        ui: { writeClipboardText: mocks.writeClipboardText },
        shell: { openUrl: mocks.openUrl }
      }
    })
    mocks.rpc.mockResolvedValue({
      status: 'ok',
      value: [
        {
          artifact: {
            byteSize: 1024,
            createdAt: '2026-08-01T12:00:00.000Z',
            deletedAt: null,
            expiresAt: '2026-09-01T12:00:00.000Z',
            originalFileName: 'report.html',
            renderedContentType: 'text/html',
            slug: 'report-123',
            sourceContentType: 'text/html',
            title: 'Quarterly report',
            updatedAt: '2026-08-02T12:00:00.000Z',
            version: 1
          },
          shareUrl: 'https://share.onorca.dev/a/report-123'
        }
      ]
    })
  })

  afterEach(cleanup)

  it('renders the selected artifact in-app with copy link as the primary action', async () => {
    render(<ArtifactsPage />)

    expect(await screen.findAllByText('Quarterly report')).toHaveLength(2)
    const closeButton = screen.getByRole('button', { name: 'Close artifacts' })
    expect(closeButton).toHaveClass('size-7', 'rounded-full')
    expect(closeButton.closest('header')).toHaveClass('px-5', 'pb-3', 'pt-1.5', 'md:px-8')
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh' })).toHaveClass(
      'border',
      'border-border/50'
    )
    const copyButton = screen.getByRole('button', { name: 'Copy link' })
    expect(copyButton).toHaveAttribute('data-variant', 'default')
    expect(copyButton.parentElement).toHaveAttribute('aria-label', 'Artifact actions')
    expect(screen.getByRole('button', { name: 'Open in browser' })).toHaveAttribute(
      'data-variant',
      'ghost'
    )
    expect(screen.getByRole('button', { name: 'Delete artifact' })).toHaveClass(
      'text-muted-foreground',
      'hover:text-destructive'
    )

    await waitFor(() => {
      const preview = document.querySelector('webview[aria-label="Artifact preview"]')
      expect(preview).toHaveAttribute('partition', 'persist:orca-default')
      expect(preview).toHaveAttribute('src', 'https://share.onorca.dev/a/report-123?embed=1')
    })

    fireEvent.click(copyButton)
    await waitFor(() =>
      expect(mocks.writeClipboardText).toHaveBeenCalledWith('https://share.onorca.dev/a/report-123')
    )
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Artifact link copied')

    fireEvent.click(screen.getByRole('button', { name: 'Open in browser' }))
    expect(mocks.openUrl).toHaveBeenCalledWith('https://share.onorca.dev/a/report-123')
  })

  it('shows a fallback when the desktop preview session is unavailable', async () => {
    mocks.resolvePartition.mockResolvedValue(null)
    render(<ArtifactsPage />)

    expect(await screen.findByText('Preview unavailable')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Open in browser' })).toBeEnabled()
  })

  it('closes from the header button and Escape', async () => {
    render(<ArtifactsPage />)
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledOnce())

    fireEvent.click(screen.getByRole('button', { name: 'Close artifacts' }))
    expect(mocks.closePage).toHaveBeenCalledOnce()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(mocks.closePage).toHaveBeenCalledTimes(2)
  })

  it('explains the agent-first sharing workflow', async () => {
    mocks.rpc.mockResolvedValue({ status: 'ok', value: [] })
    render(<ArtifactsPage />)

    const heading = await screen.findByText('No shared artifacts')
    expect(heading.parentElement).toHaveClass('flex-1', 'justify-center')
    expect(
      screen.getByText('Ask your agent to share an HTML or Markdown file, and it will appear here.')
    ).toBeInTheDocument()
    expect(screen.queryByText(/orca artifacts share/)).not.toBeInTheDocument()
  })

  it('never renders artifacts loaded for a previous account', async () => {
    let resolveFirst!: (value: unknown) => void
    mocks.rpc.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve
      })
    )
    const view = render(<ArtifactsPage />)

    mocks.authStatus = {
      activeProfileId: 'profile-b',
      cloud: { cloudProfileId: 'cloud-b', userId: 'user-b' },
      configured: true,
      state: 'connected'
    }
    mocks.rpc.mockResolvedValueOnce({ status: 'ok', value: [] })
    view.rerender(<ArtifactsPage />)
    resolveFirst({
      status: 'ok',
      value: [
        {
          artifact: {
            byteSize: 1,
            createdAt: '2026-08-01T12:00:00.000Z',
            deletedAt: null,
            expiresAt: '2026-09-01T12:00:00.000Z',
            originalFileName: 'account-a-secret.html',
            renderedContentType: 'text/html',
            slug: 'account-a-secret',
            sourceContentType: 'text/html',
            title: 'Account A secret',
            updatedAt: '2026-08-02T12:00:00.000Z',
            version: 1
          },
          shareUrl: 'https://share.onorca.dev/a/account-a-secret'
        }
      ]
    })

    await screen.findByText('No shared artifacts')
    expect(screen.queryByText('Account A secret')).not.toBeInTheDocument()
  })

  it('does not apply a completed deletion to a new account', async () => {
    let resolveDelete!: (value: unknown) => void
    mocks.confirm.mockResolvedValue(true)
    mocks.rpc.mockResolvedValueOnce({
      status: 'ok',
      value: [artifactListItem('Shared slug A', 'shared-slug')]
    })
    mocks.rpc.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveDelete = resolve
      })
    )
    const view = render(<ArtifactsPage />)

    await screen.findAllByText('Shared slug A')
    fireEvent.click(screen.getByRole('button', { name: 'Delete artifact' }))
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(2))

    mocks.authStatus = {
      activeProfileId: 'profile-b',
      cloud: { cloudProfileId: 'cloud-b', userId: 'user-b' },
      configured: true,
      state: 'connected'
    }
    mocks.rpc.mockResolvedValueOnce({
      status: 'ok',
      value: [artifactListItem('Shared slug B', 'shared-slug')]
    })
    view.rerender(<ArtifactsPage />)
    resolveDelete({ status: 'ok', value: undefined })

    expect(await screen.findAllByText('Shared slug B')).toHaveLength(2)
  })
})

function artifactListItem(title: string, slug: string): Record<string, unknown> {
  return {
    artifact: {
      byteSize: 1,
      createdAt: '2026-08-01T12:00:00.000Z',
      deletedAt: null,
      expiresAt: '2026-09-01T12:00:00.000Z',
      originalFileName: `${slug}.html`,
      renderedContentType: 'text/html',
      slug,
      sourceContentType: 'text/html',
      title,
      updatedAt: '2026-08-02T12:00:00.000Z',
      version: 1
    },
    shareUrl: `https://share.onorca.dev/a/${slug}`
  }
}
