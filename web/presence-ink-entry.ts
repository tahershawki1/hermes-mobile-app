import P5 from 'p5'
import * as brush from 'p5.brush'

export type PresenceInkApi = {
  mount: (root: HTMLElement, active: boolean) => { remove: () => void }
}

function mount(root: HTMLElement, active: boolean): { remove: () => void } {
  let disposed = false
  const sketch = (p: P5) => {
    brush.instance(p)
    p.setup = () => {
      p.createCanvas(112, 112, p.WEBGL)
      p.pixelDensity(1)
      p.frameRate(24)
      brush.scaleBrushes(1.25)
      if (!active) p.noLoop()
    }
    p.draw = () => {
      p.clear()
      const color = getComputedStyle(root).getPropertyValue('--accent').trim() || '#d9a441'
      brush.refreshField(p.frameCount / 18)
      brush.field('waves')
      brush.set('HB', color, 1.25)
      const radius = 33 + Math.sin(p.frameCount / 18) * 2.8
      for (let i = 0; i < 8; i += 1) {
        const angle = (Math.PI * 2 * i) / 8 + p.frameCount / 240
        const x1 = Math.cos(angle) * radius
        const y1 = Math.sin(angle) * radius
        const x2 = Math.cos(angle + 0.22) * (radius + 7)
        const y2 = Math.sin(angle + 0.22) * (radius + 7)
        brush.line(x1, y1, x2, y2)
      }
    }
  }
  const instance = new P5(sketch, root)
  const onVisibility = () => {
    if (document.hidden || !active) instance.noLoop()
    else instance.loop()
  }
  document.addEventListener('visibilitychange', onVisibility)
  return {
    remove: () => {
      if (!disposed) {
        disposed = true
        document.removeEventListener('visibilitychange', onVisibility)
        instance.remove()
      }
    }
  }
}

;(window as unknown as { __hmPresenceInk?: PresenceInkApi }).__hmPresenceInk = { mount }
export default { mount }
