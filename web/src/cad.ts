export type CadKind = 'dwg' | 'dxf'
export interface CadFileCheck { ok: boolean; kind?: CadKind; reason?: string }
const DWG_SIGNATURE = /^AC10(?:0[2-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9]|6[0-9]|7[0-9]|8[0-9]|9[0-9])$/
const CAD_EXTENSIONS = new Set<CadKind>(['dwg', 'dxf'])
function extension(name: string): string { return name.toLowerCase().split('.').pop() || '' }
function ascii(bytes: Uint8Array): string { return new TextDecoder().decode(bytes.slice(0, 512)).replace(/^\uFEFF/, '') }
export function validateCadFile(name: string, bytes: Uint8Array): CadFileCheck {
  const ext = extension(name)
  if (!CAD_EXTENSIONS.has(ext as CadKind)) return { ok: false, reason: 'Only DWG and DXF files are supported' }
  if (bytes.length < 4) return { ok: false, reason: 'CAD file is empty or truncated' }
  if (ext === 'dwg') return DWG_SIGNATURE.test(ascii(bytes.slice(0, 6))) ? { ok: true, kind: 'dwg' } : { ok: false, reason: 'DWG signature is invalid' }
  const text = ascii(bytes)
  return /(^|\n)\s*SECTION\s*\r?\n\s*2\s*\r?\n/i.test(text) && /(^|\n)\s*0\s*\r?\n\s*EOF\s*$/im.test(text.trim()) ? { ok: true, kind: 'dxf' } : { ok: false, reason: 'DXF signature is invalid' }
}
export interface CadEngine { inspect(input: { storedId: string; runtimeId: string; file: CadFileCheck }): Promise<{ revision: number; units?: string; crs?: string }>; mutate(input: { storedId: string; runtimeId: string; revision: number; operation: string }): Promise<void> }
export interface CadWorkspaceState { key: string; storedId: string; profile: string; runtimeId: string | null; originalName: string | null; workingCopyName: string | null; revision: number; crs: string | null; approval: { operation: string; revision: number } | null }
const workspaces = new Map<string, CadWorkspaceState>()
export function cadWorkspaceKey(profile: string, storedId: string): string { return `${profile}:${storedId}` }
export function getCadWorkspace(profile: string, storedId: string, runtimeId: string | null): CadWorkspaceState { const key = cadWorkspaceKey(profile, storedId); const existing = workspaces.get(key); if (existing) { if (runtimeId && existing.runtimeId !== runtimeId) existing.runtimeId = runtimeId; return existing }; const created: CadWorkspaceState = { key, storedId, profile, runtimeId, originalName: null, workingCopyName: null, revision: 0, crs: null, approval: null }; workspaces.set(key, created); return created }
export function requestCadMutation(state: CadWorkspaceState, operation: string): { operation: string; revision: number } { state.approval = { operation, revision: state.revision }; return state.approval }
export function approveCadMutation(state: CadWorkspaceState, approval: { operation: string; revision: number }): boolean { if (!state.approval || state.approval.operation !== approval.operation || state.approval.revision !== state.revision) return false; state.approval = null; state.revision += 1; return true }
export function resetCadWorkspaces(): void { workspaces.clear() }
