declare module 'p5.brush' {
  export function instance(p: unknown): void
  export function scaleBrushes(scale: number): void
  export function field(name: string): void
  export function refreshField(time: number): void
  export function set(name: string, color: string, weight: number): void
  export function line(x1: number, y1: number, x2: number, y2: number): void
}
