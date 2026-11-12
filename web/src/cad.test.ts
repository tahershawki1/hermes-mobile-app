import { describe, expect, it } from 'vitest'
import { approveCadMutation, cadWorkspaceKey, getCadWorkspace, requestCadMutation, resetCadWorkspaces, validateCadFile } from './cad'

describe('CAD vertical slice', () => {
  it('binds workspace state to profile and storedId while runtimeId remains live-only', () => {
    resetCadWorkspaces()
    const a = getCadWorkspace('p', 'stored-1', 'runtime-a')
    const same = getCadWorkspace('p', 'stored-1', 'runtime-b')
    expect(same).toBe(a)
    expect(same.runtimeId).toBe('runtime-b')
    expect(cadWorkspaceKey('p', 'stored-1')).toBe('p:stored-1')
    expect(getCadWorkspace('p', 'stored-2', 'runtime-c')).not.toBe(a)
  })

  it('rejects unsupported extensions and invalid signatures', () => {
    expect(validateCadFile('plan.dws', new TextEncoder().encode('AC1032'))).toMatchObject({ ok: false })
    expect(validateCadFile('plan.dwt', new TextEncoder().encode('AC1032'))).toMatchObject({ ok: false })
    expect(validateCadFile('plan.dwg', new TextEncoder().encode('not dwg'))).toMatchObject({ ok: false })
    expect(validateCadFile('plan.dxf', new TextEncoder().encode('SECTION\n2\nHEADER\n0\nEOF'))).toMatchObject({ ok: true, kind: 'dxf' })
  })

  it('requires a matching, current approval before mutation', () => {
    resetCadWorkspaces()
    const state = getCadWorkspace('p', 'stored-1', 'runtime-a')
    const approval = requestCadMutation(state, 'move entity')
    expect(approveCadMutation(state, { ...approval, revision: approval.revision + 1 })).toBe(false)
    expect(approveCadMutation(state, approval)).toBe(true)
    expect(approveCadMutation(state, approval)).toBe(false)
  })
})
