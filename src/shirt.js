/* Draws the selected real shirt photo onto a canvas, fitted to the person's shoulders and torso. */
import { CLOTHES, CATS, IMGS } from './clothes.js'
export const EASE = { S: 1.0, M: 1.09, L: 1.18, XL: 1.28 }
export const MATEASE = { cotton: 1, linen: 1.05, silk: .96, denim: 1.06, wool: 1.04 }

const tex = (draw, s) => { const c = document.createElement('canvas'); c.width = c.height = s; draw(c.getContext('2d'), s); return c }
const TEX = {
  cotton: tex((x, s) => { x.fillStyle = '#fff3'; x.fillRect(0, 0, 1.5, 1.5); x.fillStyle = '#0002'; x.fillRect(s / 2, s / 2, 1.5, 1.5) }, 4),
  linen: tex((x, s) => { x.fillStyle = '#fff4'; x.fillRect(0, 0, s, 1); x.fillStyle = '#0003'; x.fillRect(0, 0, 1, s) }, 5),
  denim: tex((x, s) => { x.strokeStyle = '#0003'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(0, s); x.lineTo(s, 0); x.stroke() }, 5),
  wool: tex((x, s) => { for (let i = 0; i < 10; i++) { x.fillStyle = i % 2 ? '#fff3' : '#0002'; x.beginPath(); x.arc(Math.random() * s, Math.random() * s, 1.3, 0, 7); x.fill() } }, 9)
}


/* photo + material texture (shirts & dresses only), cached */
let cache = { key: '', cv: null }
export function shirtCanvas(o) {
  const im = IMGS[o.type]; if (!im || !im.naturalWidth) return null
  if (!CATS[CLOTHES[o.type].cat].body) return im
  if (cache.cv && cache.key === `${o.type}|${o.mat}`) return cache.cv
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight
  const x = c.getContext('2d'); x.drawImage(im, 0, 0)
  x.globalCompositeOperation = 'source-atop'
  if (o.mat !== 'cotton') x.globalAlpha = .55
  if (o.mat === 'cotton') { /* plain cotton: keep the photo clean */ }
  else if (o.mat === 'silk') {
    const g = x.createLinearGradient(0, 0, c.width, c.height)
    g.addColorStop(0, '#fff0'); g.addColorStop(.3, '#ffffff66'); g.addColorStop(.55, '#0000001a'); g.addColorStop(1, '#ffffff33'); x.fillStyle = g
  } else x.fillStyle = x.createPattern(TEX[o.mat], 'repeat')
  if (o.mat !== 'cotton') x.fillRect(0, 0, c.width, c.height)
  cache = { key: `${o.type}|${o.mat}`, cv: c }
  return c
}
export const shirtURL = o => { const c = shirtCanvas(o); return c && c.toDataURL ? c.toDataURL('image/png') : CLOTHES[o.type].src }
export const modeOf = type => CATS[CLOTHES[type].cat].mode
export const isFace = type => modeOf(type) === 'face'

export function drawShirt(c, P, o) {
  const src = shirtCanvas(o); if (!src) return
  const a = CLOTHES[o.type]
  if (modeOf(o.type) === 'neck') {                        /* necklaces: top of the chain sits at the base of the neck */
    const { L, R, M, H } = P, sw = Math.hypot(R.x - L.x, R.y - L.y) || 1, T = Math.hypot(M.x - H.x, M.y - H.y) || 1
    const up = { x: (M.x - H.x) / T, y: (M.y - H.y) / T }, ang = Math.atan2(R.y - L.y, R.x - L.x)
    const nw = src.naturalWidth || src.width, sw0 = P.sw0 || sw, s = sw0 * a.w / nw
    c.save(); c.shadowColor = '#0006'; c.shadowBlur = sw * .05; c.shadowOffsetY = sw * .02
    c.translate(M.x + up.x * sw * a.dy, M.y + up.y * sw * a.dy); c.rotate(ang); c.scale(s * sw / sw0, s)
    c.drawImage(src, -nw / 2, 0); c.restore(); return
  }
  if (isFace(o.type)) {                                   /* glasses + hats: anchored to the eyes */
    const { fL, fR } = P, ed = Math.hypot(fR.x - fL.x, fR.y - fL.y) || 1, ang = Math.atan2(fR.y - fL.y, fR.x - fL.x), ed0 = P.ed0 || ed
    const C = a.cat === 'hats' && P.fCh ? P.fCh : { x: (fL.x + fR.x) / 2, y: (fL.y + fR.y) / 2 }, up = { x: Math.sin(ang), y: -Math.cos(ang) }
    const nw = src.naturalWidth || src.width, nh = src.naturalHeight || src.height, s = ed0 * a.w / nw
    const [ax, ay] = a.a || [nw / 2, nh / 2]
    c.save(); c.shadowColor = '#0005'; c.shadowBlur = ed * .12; c.shadowOffsetY = ed * .05
    c.translate(C.x + up.x * ed0 * a.dy, C.y + up.y * ed0 * a.dy); c.rotate(ang); c.scale(s * ed / ed0, s)
    c.drawImage(src, -ax, -ay); c.restore(); return
  }
  const { L, R, M, H } = P
  const sw = Math.hypot(R.x - L.x, R.y - L.y) || 1, T = Math.hypot(M.x - H.x, M.y - H.y) || 1
  const up = { x: (M.x - H.x) / T, y: (M.y - H.y) / T }, ang = Math.atan2(R.y - L.y, R.x - L.x)
  const k = EASE[o.size] * MATEASE[o.mat], d = a.R[0] - a.L[0]
  const sw0 = P.sw0 || sw, sx = sw * k * 1.04 / d, sx0 = sw0 * k * 1.04 / d
  const ih = (src.naturalHeight || src.height) - a.L[1]
  const sy = a.cat === 'dresses' ? T * 2.15 * (1 + (k - 1) * .2) / ih : sx0 * (1 + (k - 1) * .35)   /* dress hem lands near the knee/calf */
  const ax = (a.L[0] + a.R[0]) / 2, ay = a.L[1], lift = sw * .05
  c.save()
  c.shadowColor = '#0006'; c.shadowBlur = sw * .1; c.shadowOffsetY = sw * .03
  c.translate(M.x + up.x * lift, M.y + up.y * lift); c.rotate(ang); c.scale(sx, sy)
  c.drawImage(src, -ax, -ay)
  c.restore()
}
