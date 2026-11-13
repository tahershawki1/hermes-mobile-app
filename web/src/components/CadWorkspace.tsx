import { useEffect, useMemo, useRef, useState } from 'react'
import { attachFile } from '../gateway'
import { toast, setState, getState, useStore } from '../store'
import { getCadWorkspace, openCadWorkspace, rebindCadWorkspace, type CadWorkspaceState } from '../cad'

export function CadWorkspace() {
  const profile = useStore(s => s.profile)
  const active = useStore(s => s.active)
  const key = active?.storedId || `new:${profile}`
  const state = useMemo(() => getCadWorkspace(profile, key, active?.runtimeId || null), [profile, key, active?.runtimeId])
  const [workspace, setWorkspace] = useState<CadWorkspaceState>(state)
  const input = useRef<HTMLInputElement>(null)
  const [crs, setCrs] = useState(state.crs || '')
  const [uploading, setUploading] = useState(false)
  useEffect(() => { setCrs(state.crs || '') }, [state.key, state.crs])
  const refresh = () => setWorkspace({ ...state })
  const open = async (file: File) => {
    setUploading(true)
    const previous = { originalName: state.originalName, workingCopyName: state.workingCopyName, revision: state.revision, inspection: state.inspection, session: state.session, approval: state.approval }
    try {
      await openCadWorkspace(state, file)
      await attachFile(file)
      const current = getState().active
      if (current && state.storedId !== current.storedId) rebindCadWorkspace(state, profile, current.storedId, current.runtimeId)
      refresh()
    } catch (e) {
      toast(String(e instanceof Error ? e.message : e), 'error')
      state.originalName = previous.originalName; state.workingCopyName = previous.workingCopyName; state.revision = previous.revision; state.inspection = previous.inspection; state.session = previous.session; state.approval = null
      refresh()
    } finally { setUploading(false) }
  }
  return <section className="screen cad-workspace" aria-label="CAD workspace">
    <div className="screen-head"><button className="btn" onClick={() => setState({ screen: null })}>Back to chat</button><h1>CAD workspace</h1><button className="btn" onClick={() => setState({ screen: null })}>Close</button></div>
    <p className="dim">Conversation: <code>{key}</code> · runtime: <code>{state.runtimeId || 'not connected'}</code></p>
    <div className="cad-card"><b>Original</b><span>{state.originalName || 'No DWG/DXF loaded'}</span><b>Working copy</b><span>{state.session ? 'In-memory working copy; original is preserved' : 'No working copy'}</span>{state.inspection && <><b>Drawing</b><span>{state.inspection.entityCount} entities · {state.inspection.layerNames.length} layers · {state.inspection.format.toUpperCase()}</span></>}</div>
    <button className="btn" onClick={() => input.current?.click()} disabled={uploading}>{uploading ? 'Uploading…' : 'Open DWG/DXF'}</button>
    <input ref={input} type="file" accept=".dwg,.dxf" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void open(f) }} />
    <label>CRS <input value={crs} placeholder="Unknown until set" onChange={e => { const value = e.target.value; setCrs(value); state.crs = value || null; state.session?.setCrs(value || null); if (state.inspection) state.inspection = state.session?.inspect() || state.inspection; refresh() }} /></label>
    <p className="dim">{state.crs ? `CRS: ${state.crs}` : 'CRS unknown — set it before coordinate-aware operations.'}</p>
    <p className="dim">CAD edits are disabled in this MVP surface until a specific operation is selected and approved. The core session rejects unapproved mutations.</p>
  </section>
}
