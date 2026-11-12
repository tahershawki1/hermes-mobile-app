import type { Drawing, LineEnt } from '../model/types';
import { CadDoc } from '../doc/CadDoc';

export type CadFormat = 'dwg' | 'dxf';

export class CadFormatError extends Error {
  constructor(message: string) { super(message); this.name = 'CadFormatError'; }
}

export interface LineMutation { kind: 'add-line'; entity: LineEnt }
export interface DeleteMutation { kind: 'delete'; id: number }
export interface UndoMutation { kind: 'undo' }
export type Mutation = LineMutation | DeleteMutation | UndoMutation;
export interface MutationRequest { readonly id: number; readonly mutation: Mutation }
export interface JournalEntry { id: number; mutation: Mutation }

export interface CadInspection {
  format: CadFormat;
  entityCount: number;
  layerNames: string[];
  crs: string;
  warnings: string[];
  journalLength: number;
}

export interface CreateCadSessionOptions {
  fileName: string;
  originalBytes: Uint8Array;
  drawing: Drawing;
  crs?: string;
}

const clone = <T>(value: T): T => typeof structuredClone === 'function'
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value)) as T;

function validateFormat(bytes: Uint8Array, fileName: string): CadFormat {
  if (/\.(dws|dwt)$/i.test(fileName)) throw new CadFormatError('DWS and DWT are not supported; use DWG or DXF.');
  const signature = String.fromCharCode(...bytes.slice(0, 6));
  if (/^AC\d{4}$/.test(signature)) {
    if (!/\.dwg$/i.test(fileName)) throw new CadFormatError('DWG signature requires a .dwg filename.');
    return 'dwg';
  }
  if (/\.dwg$/i.test(fileName)) throw new CadFormatError('Invalid DWG signature.');
  if (!/\.dxf$/i.test(fileName)) throw new CadFormatError('Only DWG and DXF files are supported.');
  const head = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 8192)));
  const tail = new TextDecoder().decode(bytes.slice(Math.max(0, bytes.length - 8192)));
  if (!/(^|\r?\n)\s*0\s*(\r?\n|$)\s*SECTION\s*(\r?\n|$)\s*2\s*(\r?\n|$)/i.test(head) || !/(^|\r?\n)\s*0\s*(\r?\n|$)\s*EOF\s*$/im.test(tail.trim())) throw new CadFormatError('Invalid DXF signature.');
  return 'dxf';
}

/** Conversation-scoped CAD state. Parsing is deliberately supplied by the worker/client layer. */
export class CadSession {
  readonly format: CadFormat;
  private readonly original: Uint8Array;
  private readonly doc: CadDoc;
  private crsName: string;
  private readonly pending = new Map<number, MutationRequest>();
  private readonly entries: JournalEntry[] = [];
  private nextRequest = 1;

  constructor(options: CreateCadSessionOptions) {
    this.format = validateFormat(options.originalBytes, options.fileName);
    this.original = options.originalBytes.slice();
    this.doc = new CadDoc(clone(options.drawing));
    this.crsName = options.crs ?? 'unknown';
  }

  originalBytes(): Uint8Array { return this.original.slice(); }
  workingCopy(): Drawing { return this.doc.snapshot(); }
  setCrs(crs: string | null): void { this.crsName = crs || 'unknown'; }

  inspect(): CadInspection {
    return {
      format: this.format,
      entityCount: this.doc.size,
      layerNames: this.workingCopy().layers.map((layer) => layer.name),
      crs: this.crsName,
      warnings: ['2D MVP: Z is treated as 0; elevation data is not editable.'],
      journalLength: this.entries.length,
    };
  }
  journal(): readonly JournalEntry[] { return this.entries.map((entry) => clone(entry)); }

  propose(mutation: Mutation): MutationRequest {
    const request = { id: this.nextRequest++, mutation: clone(mutation) };
    this.pending.set(request.id, request);
    return request;
  }

  /** Approves and applies exactly one previously proposed mutation. */
  approve(request: MutationRequest): void {
    const pending = this.pending.get(request.id);
    if (!pending || pending.id !== request.id || JSON.stringify(pending.mutation) !== JSON.stringify(request.mutation)) throw new Error('Unknown or already approved mutation.');
    this.pending.delete(request.id);
    this.applyApproved(request.mutation);
  }

  /** Mutation execution is intentionally not public without approve(). */
  apply(_request: MutationRequest): never { throw new Error('Mutation requires explicit approval.'); }

  private applyApproved(mutation: Mutation): void {
    if (mutation.kind === 'undo') {
      if (!this.doc.canUndo) return;
      this.doc.undo();
      this.entries.pop();
      return;
    }
    if (mutation.kind === 'add-line') {
      this.doc.add([clone(mutation.entity)], 'Add line');
    } else if (this.doc.get(mutation.id)) {
      this.doc.remove([mutation.id], 'Delete entity');
    } else {
      return;
    }
    this.entries.push({ id: this.entries.length + 1, mutation: clone(mutation) });
  }

  proposeUndo(): MutationRequest { return this.propose({ kind: 'undo' }); }
}

export function createCadSession(options: CreateCadSessionOptions): CadSession { return new CadSession(options); }
