// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  openArtifactsPage: vi.fn()
}))

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      connectCurrentOrcaProfile: mocks.connect,
      openArtifactsPage: mocks.openArtifactsPage,
      orcaProfileAuthStatus: { configured: true, state: 'connected' },
      orcaProfileConnecting: false
    })
}))

import { ArtifactsSettingsPane } from './ArtifactsSettingsPane'

describe('ArtifactsSettingsPane', () => {
  beforeEach(() => {
    mocks.connect.mockReset()
    mocks.openArtifactsPage.mockReset()
  })

  afterEach(cleanup)

  it('explains the complete sharing workflow', () => {
    render(
      <ArtifactsSettingsPane
        settings={{ ...getDefaultSettings('/tmp'), showArtifactsButton: true }}
        updateSettings={vi.fn()}
      />
    )

    expect(screen.getByText('How to use Artifacts')).toBeInTheDocument()
    expect(screen.getByText('Ask your agent to share it')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Your agent uses the Orca CLI for the upload. Just ask: “Share this HTML mock as an artifact.”'
      )
    ).toBeInTheDocument()
    expect(screen.getByText('Share the public link')).toBeInTheDocument()
    expect(
      screen.getByText('Your agent returns a link that anyone with the URL can view.')
    ).toBeInTheDocument()
    expect(screen.getByText('Manage it in Orca')).toBeInTheDocument()
    expect(
      screen.getByText('Preview, copy, and manage links shared through your account.')
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Uploads require sign-in; public links do not.')
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Orca account')).not.toBeInTheDocument()
  })

  it('controls only sidebar visibility and always allows opening Artifacts', async () => {
    const user = userEvent.setup()
    const updateSettings = vi.fn()
    render(
      <ArtifactsSettingsPane
        settings={{ ...getDefaultSettings('/tmp'), showArtifactsButton: false }}
        updateSettings={updateSettings}
      />
    )

    const toggle = screen.getByRole('switch', { name: 'Show Artifacts Button' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    await user.click(toggle)
    expect(updateSettings).toHaveBeenCalledWith({ showArtifactsButton: true })

    expect(screen.queryByText(/orca artifacts share/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copy command' })).not.toBeInTheDocument()

    const openButton = screen.getByRole('button', { name: /Open Artifacts/ })
    expect(openButton).toBeEnabled()
    await user.click(openButton)
    expect(mocks.openArtifactsPage).toHaveBeenCalledOnce()
  })
})
