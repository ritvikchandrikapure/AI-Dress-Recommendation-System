import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

let vision
const cache = {}
export async function getPose(mode) {
  vision ??= await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm')
  return (cache[mode] ??= await PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task' },
    runningMode: mode, numPoses: 1
  }))
}

/* Landmarks -> the few body points the shirt needs (pixels). Needs only the shoulders. */
export function points(lm, w, h) {
  const ok = i => !!lm[i] && (lm[i].visibility ?? 1) > .5, g = i => ({ x: lm[i].x * w, y: lm[i].y * h })
  if (!ok(11) || !ok(12)) return null
  const a = g(11), b = g(12), flip = a.x >= b.x
  const [iL, iR] = flip ? [12, 11] : [11, 12], L = flip ? b : a, R = flip ? a : b
  const sw = Math.hypot(R.x - L.x, R.y - L.y), M = { x: (L.x + R.x) / 2, y: (L.y + R.y) / 2 }
  const H = ok(23) && ok(24) ? { x: (lm[23].x + lm[24].x) / 2 * w, y: (lm[23].y + lm[24].y) / 2 * h } : { x: M.x, y: M.y + sw * 1.45 }
  const el = (i, S, s) => ok(i + 2) ? g(i + 2) : { x: S.x + s * sw * .1, y: S.y + sw * .9 }
  return { L, R, M, H, eL: el(iL, L, -1), eR: el(iR, R, 1) }
}

/* Face points for glasses and hats (eyes are enough). */
export function facePoints(lm, w, h) {
  const ok = i => !!lm[i] && (lm[i].visibility ?? 1) > .4
  if (!ok(2) || !ok(5)) return null
  let a = { x: lm[2].x * w, y: lm[2].y * h }, b = { x: lm[5].x * w, y: lm[5].y * h }
  if (a.x > b.x) [a, b] = [b, a]
  return { fL: a, fR: b }
}

/* No AI? Place the shirt by hand with sliders. */
export function manualLm({ x, y, s }) {
  const l = Array(25).fill({ x: .5, y: .5, visibility: 1 }), hw = .17 * s, ty = .3 + y, cx = .5 + x, tl = .3 * s
  l[11] = { x: cx - hw, y: ty }; l[12] = { x: cx + hw, y: ty }; l[13] = { x: cx - hw - .04, y: ty + .14 * s }; l[14] = { x: cx + hw + .04, y: ty + .14 * s }
  l[23] = { x: cx - .09 * s, y: ty + tl }; l[24] = { x: cx + .09 * s, y: ty + tl }
  const ey = ty - .2 * s, ed = .045 * s
  l[2] = { x: cx - ed, y: ey }; l[5] = { x: cx + ed, y: ey }
  return l
}

export function smoothP(prev, P, k = .5) {
  if (!prev || Object.keys(P).some(k => !prev[k])) return P
  const o = {}
  for (const key in P) o[key] = { x: prev[key].x + (P[key].x - prev[key].x) * k, y: prev[key].y + (P[key].y - prev[key].y) * k }
  return o
}
