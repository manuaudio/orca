// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
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
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      closeArtifactsPage: mocks.closePage,
      connectCurrentOrcaProfile: mocks.connect,
      orcaProfileAuthStatus: { configured: true, state: 'connected' },
      orcaProfileConnecting: false,
      refreshCurrentOrcaProfileAuth: mocks.refreshAuth
    })
}))

import ArtifactsPage from './ArtifactsPage'

describe('ArtifactsPage', () => {
  beforeEach(() => {
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
    expect(screen.getByRole('button', { name: 'Open in browser' })).toHaveAttribute(
      'data-variant',
      'outline'
    )
    expect(screen.getByRole('button', { name: 'Delete artifact' })).toHaveClass('text-destructive')

    await waitFor(() => {
      const preview = document.querySelector('webview[aria-label="Artifact preview"]')
      expect(preview).toHaveAttribute('partition', 'persist:orca-default')
      expect(preview).toHaveAttribute('src', 'https://share.onorca.dev/a/report-123')
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
})
