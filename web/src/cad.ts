import { readCadFile } from './cad/io/cadClient'
import { createCadSession, type CadSession } from './cad/session/session'

export type CadKind = 'dwg' | 'dxf'
export interface CadFileCheck { ok: boolean; kind?: CadKind; reason?: string }
const DWG_SIGNATURE = /^AC10(?:0[2-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9]|6[0-9]|7[0-9]|8[0-9]|9[0-9])$/
const CAD_EXTENSIONS = new Set<CadKind>(['dwg', 'dxf'])
function extension(name: string): string { return name.toLowerCase().split('.').pop() || '' }
function ascii(bytes: Uint8Array): string { return new TextDecoder().decode(bytes).replace(/^\uFEFF/, '') }

export function validateCadFile(name: string, bytes: Uint8Array): CadFileCheck {
  const ext = extension(name)
  if (!CAD_EXTENSIONS.has(ext as CadKind)) return { ok: false, reason: 'Only DWG and DXF files are supported' }
  if (bytes.length < 4) return { ok: false, reason: 'CAD file is empty or truncated' }
  if (ext === 'dwg') return DWG_SIGNATURE.test(ascii(bytes.slice(0, 6))) ? { ok: true, kind: 'dwg' } : { ok: false, reason: 'DWG signature is invalid' }
  const head = ascii(bytes.slice(0, Math.min(bytes.length, 8192)))
  const tail = ascii(bytes.slice(Math.max(0, bytes.length - 8192)))
  return /(^|\r?\n)\s*0\s*(\r?\n|$)\s*SECTION\s*(\r?\n|$)\s*2\s*(\r?\n|$)/i.test(head) && /(^|\r?\n)\s*0\s*(\r?\n|$)\s*EOF\s*$/im.test(tail.trim())
    ? { ok: true, kind: 'dxf' }
    : { ok: false, reason: 'DXF signature is invalid' }
}

export interface CadInspection {
  format: CadKind
  entityCount: number
  layerNames: string[]
  crs: string
  warnings: string[]
  journalLength: number
}
export interface CadWorkspaceState {
  key: string
  storedId: string
  profile: string
  runtimeId: string | null
  originalName: string | null
  workingCopyName: string | null
  revision: number
  crs: string | null
  approval: { operation: string; revision: number } | null
  inspection: CadInspection | null
  session: CadSession | null
}
const workspaces = new Map<string, CadWorkspaceState>()
export function cadWorkspaceKey(profile: string, storedId: string): string { return `${profile}:${storedId}` }
export function getCadWorkspace(profile: string, storedId: string, runtimeId: string | null): CadWorkspaceState {
  const key = cadWorkspaceKey(profile, storedId)
  const existing = workspaces.get(key)
  if (existing) {
    if (runtimeId && existing.runtimeId !== runtimeId) existing.runtimeId = runtimeId
    return existing
  }
  const created: CadWorkspaceState = { key, storedId, profile, runtimeId, originalName: null, workingCopyName: null, revision: 0, crs: null, approval: null, inspection: null, session: null }
  workspaces.set(key, created)
  return created
}
export async function openCadWorkspace(state: CadWorkspaceState, file: File): Promise<CadWorkspaceState> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const check = validateCadFile(file.name, bytes)
  if (!check.ok || !check.kind) throw new Error(check.reason || 'Invalid CAD file')
  const result = await readCadFile(bytes, file.name)
  const session = createCadSession({ fileName: file.name, originalBytes: bytes, drawing: result.drawing, crs: state.crs || undefined })
  state.session = session
  state.originalName = file.name
  state.workingCopyName = null
  state.revision = 0
  state.inspection = session.inspect()
  return state
}
export function requestCadMutation(state: CadWorkspaceState, operation: string): { operation: string; revision: number } { state.approval = { operation, revision: state.revision }; return state.approval }
export function approveCadMutation(state: CadWorkspaceState, approval: { operation: string; revision: number }): boolean {
  if (!state.approval || state.approval.operation !== approval.operation || state.approval.revision !== approval.revision || approval.revision !== state.revision) return false
  state.approval = null
  state.revision += 1
  return true
}
export function rebindCadWorkspace(state: CadWorkspaceState, profile: string, storedId: string, runtimeId: string | null): CadWorkspaceState {
  const nextKey = cadWorkspaceKey(profile, storedId)
  const existing = workspaces.get(nextKey)
  if (existing && existing !== state) throw new Error(`CAD workspace already exists for ${storedId}`)
  workspaces.delete(state.key)
  state.key = nextKey
  state.profile = profile
  state.storedId = storedId
  state.runtimeId = runtimeId
  state.approval = null
  workspaces.set(nextKey, state)
  return state
}
export function resetCadWorkspaces(): void { workspaces.clear() }
