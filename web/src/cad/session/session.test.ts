import { describe, expect, it } from 'vitest';
import { createCadSession, CadFormatError, type LineMutation } from './session';
import { emptyDrawing } from '../model/types';

const dxf = new TextEncoder().encode('0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n');
const line = (id: number) => ({ id, type: 'line' as const, layer: '0', p1: { x: 0, y: 0 }, p2: { x: 10, y: 0 } });

function session() {
  const drawing = emptyDrawing('fixture');
  drawing.entities = [line(1)];
  drawing.nextId = 2;
  return createCadSession({ fileName: 'fixture.dxf', originalBytes: dxf, drawing });
}

describe('CAD session', () => {
  it('accepts DXF and DWG signatures but rejects DWS/DWT and invalid content', () => {
    expect(() => createCadSession({ fileName: 'drawing.dws', originalBytes: dxf, drawing: emptyDrawing() })).toThrow(CadFormatError);
    expect(() => createCadSession({ fileName: 'drawing.dwt', originalBytes: dxf, drawing: emptyDrawing() })).toThrow(CadFormatError);
    expect(() => createCadSession({ fileName: 'drawing.dxf', originalBytes: new Uint8Array([1, 2]), drawing: emptyDrawing() })).toThrow(CadFormatError);
    expect(createCadSession({ fileName: 'drawing.dwg', originalBytes: new TextEncoder().encode('AC1032' + 'x'), drawing: emptyDrawing() }).format).toBe('dwg');
  });

  it('accepts a DXF whose EOF marker is outside the initial signature window', () => {
    const large = new Uint8Array(10000).fill(32);
    large.set(new TextEncoder().encode('0\nSECTION\n2\nHEADER\n'), 0);
    large.set(new TextEncoder().encode('0\nEOF\n'), large.length - 6);
    expect(createCadSession({ fileName: 'large.dxf', originalBytes: large, drawing: emptyDrawing() }).format).toBe('dxf');
  });

  it('accepts an equivalent serialized approval request', () => {
    const s = session();
    const request = s.propose({ kind: 'delete', id: 1 });
    expect(() => s.approve(JSON.parse(JSON.stringify(request)))).not.toThrow();
  });
  it('preserves original bytes and reports the 2D Z=0 warning', () => {
    const bytes = dxf.slice();
    const s = session();
    bytes[0] = 88;
    expect(s.originalBytes()[0]).toBe(dxf[0]);
    expect(s.inspect().warnings).toContain('2D MVP: Z is treated as 0; elevation data is not editable.');
    expect(s.inspect().crs).toBe('unknown');
  });

  it('requires approval for add/delete mutations and supports undo', () => {
    const s = session();
    const add: LineMutation = { kind: 'add-line', entity: { ...line(2), p2: { x: 2, y: 2 } } };
    const request = s.propose(add);
    expect(s.inspect().entityCount).toBe(1);
    s.approve(request);
    expect(s.inspect().entityCount).toBe(2);
    const deletion = s.propose({ kind: 'delete', id: 2 });
    expect(() => s.apply(deletion)).toThrow(/approval/i);
    s.approve(deletion);
    expect(s.inspect().entityCount).toBe(1);
    const undo = s.proposeUndo();
    s.approve(undo);
    expect(s.inspect().entityCount).toBe(2);
  });

  it('returns read-only snapshots and a journal', () => {
    const s = session();
    const snapshot = s.workingCopy();
    snapshot.entities.length = 0;
    expect(s.inspect().entityCount).toBe(1);
    expect(s.journal()).toHaveLength(0);
  });
});
