import { describe, expect, it } from 'vitest'
import { getOpenFilesForExternalFileChange } from './editor-autosave'
import type { OpenFile } from '@/store/slices/editor'

// Why: a terminal link opens a WSL file through the forward-slash UNC form
// (`//wsl.localhost/Ubuntu/...`) while the Files sidebar stores the backslash
// form, so an external-change notification built from the worktree path only
// matched one of them and the terminal-opened tab never reloaded (#13349).
function editTab(filePath: string): OpenFile {
  return {
    worktreeId: 'wt1',
    filePath,
    mode: 'edit'
  } as unknown as OpenFile
}

describe('getOpenFilesForExternalFileChange — WSL UNC spellings', () => {
  const target = {
    worktreeId: 'wt1',
    worktreePath: '\\\\wsl.localhost\\Ubuntu\\home\\me\\repo',
    relativePath: 'media-ui/test.txt'
  }

  it('matches a tab opened through the forward-slash UNC form', () => {
    const tab = editTab('//wsl.localhost/Ubuntu/home/me/repo/media-ui/test.txt')
    expect(getOpenFilesForExternalFileChange([tab], target)).toEqual([tab])
  })

  it('still matches the backslash form the Files sidebar stores', () => {
    const tab = editTab('\\\\wsl.localhost\\Ubuntu\\home\\me\\repo\\media-ui\\test.txt')
    expect(getOpenFilesForExternalFileChange([tab], target)).toEqual([tab])
  })

  it('matches the legacy \\\\wsl$ alias for the same file', () => {
    const tab = editTab('//wsl$/Ubuntu/home/me/repo/media-ui/test.txt')
    expect(getOpenFilesForExternalFileChange([tab], target)).toEqual([tab])
  })

  it('folds distro case, which the terminal link does not lowercase', () => {
    const tab = editTab('//wsl.localhost/ubuntu/home/me/repo/media-ui/test.txt')
    expect(getOpenFilesForExternalFileChange([tab], target)).toEqual([tab])
  })

  it('does not match a different file in the same worktree', () => {
    const tab = editTab('//wsl.localhost/Ubuntu/home/me/repo/media-ui/other.txt')
    expect(getOpenFilesForExternalFileChange([tab], target)).toEqual([])
  })

  it('does not match the same relative path under a different distro', () => {
    const tab = editTab('//wsl.localhost/Debian/home/me/repo/media-ui/test.txt')
    expect(getOpenFilesForExternalFileChange([tab], target)).toEqual([])
  })

  it('leaves POSIX paths untouched, where backslash is a legal filename char', () => {
    const posixTarget = {
      worktreeId: 'wt1',
      worktreePath: '/home/me/repo',
      relativePath: 'a/b.txt'
    }
    const tab = editTab('/home/me/repo/a/b.txt')
    expect(getOpenFilesForExternalFileChange([tab], posixTarget)).toEqual([tab])
    const backslashTab = editTab('/home/me/repo/a\\b.txt')
    expect(getOpenFilesForExternalFileChange([backslashTab], posixTarget)).toEqual([])
  })
})
