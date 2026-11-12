import { useMemo, useRef, useState } from 'react'
import { attachFile } from '../gateway'
import { toast, setState, useStore } from '../store'
import { getCadWorkspace, requestCadMutation, approveCadMutation, type CadWorkspaceState } from '../cad'

export function CadWorkspace() {
  const profile = useStore(s => s.profile)
  const active = useStore(s => s.active)
  const key = active?.storedId || `new:${profile}`
  const state = useMemo(() => getCadWorkspace(profile, key, active?.runtimeId || null), [profile, key, active?.runtimeId])
  const [workspace, setWorkspace] = useState<CadWorkspaceState>(state)
  const input = useRef<HTMLInputElement>(null)
  const [crs, setCrs] = useState(state.crs || '')
  const [uploading, setUploading] = useState(false)
  const refresh = () => setWorkspace({ ...state })
  const open = async (file: File) => {
    setUploading(true)
    try {
      await attachFile(file)
      state.originalName = file.name
      state.workingCopyName = `${file.name}.working-copy`
      refresh()
    } catch (e) { toast(String(e instanceof Error ? e.message : e), 'error') } finally { setUploading(false) }
  }
  const askMutation = () => { requestCadMutation(state, 'Apply approved CAD change'); refresh() }
  const approve = () => { if (!state.approval || !approveCadMutation(state, state.approval)) { toast('Approval is stale; review the current workspace', 'error'); return }; refresh() }
  return <section className="screen cad-workspace" aria-label="CAD workspace">
    <div className="screen-head"><button className="btn" onClick={() => setState({ screen: null })}>Back to chat</button><h1>CAD workspace</h1><button className="btn" onClick={() => setState({ screen: null })}>Close</button></div>
    <p className="dim">Conversation: <code>{key}</code> · runtime: <code>{state.runtimeId || 'not connected'}</code></p>
    <div className="cad-card"><b>Original</b><span>{state.originalName || 'No DWG/DXF loaded'}</span><b>Working copy</b><span>{state.workingCopyName || 'Created after opening a file'}</span></div>
    <button className="btn" onClick={() => input.current?.click()} disabled={uploading}>{uploading ? 'Uploading…' : 'Open DWG/DXF'}</button>
    <input ref={input} type="file" accept=".dwg,.dxf" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void open(f) }} />
    <label>CRS <input value={crs} placeholder="Unknown until set" onChange={e => { setCrs(e.target.value); state.crs = e.target.value || null; refresh() }} /></label>
    <p className="dim">{state.crs ? `CRS: ${state.crs}` : 'CRS unknown — set it before coordinate-aware operations.'}</p>
    <div className="cad-actions"><button className="btn danger" onClick={askMutation} disabled={!state.originalName}>Request CAD mutation approval</button>{state.approval && <div role="alert">Approval required for “{state.approval.operation}” at revision {state.approval.revision}. <button className="btn" onClick={approve}>Approve and apply</button></div>}</div>
  </section>
}
