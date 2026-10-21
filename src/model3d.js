/* Real-time 3D male / female models, written in plain WebGL (no libraries).
   Bodies are lofted from cross-sections (cm units, y up, model faces +z). Items are 2D photos placed on
   the projected shoulders / eyes (see drawShirt), so the model can be dragged to turn a little. */
import { CLOTHES } from './clothes.js'
import { modeOf } from './shirt.js'

export const MW = 600, MH = 840
const TAU = Math.PI * 2, D = 500
export const SKINS = [['Fair', '#f1cfb4'], ['Wheatish', '#d6a27b'], ['Deep', '#8f6144']]
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
const mixc = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)

/* ---------- mesh helpers ---------- */
const mesh = c => ({ p: [], i: [], c })
function orient(m, from = 0) {                       /* make triangle winding point away from the mesh centre */
  const P = m.p, n = P.length / 3; let cx = 0, cy = 0, cz = 0
  for (let k = 0; k < n; k++) { cx += P[3 * k]; cy += P[3 * k + 1]; cz += P[3 * k + 2] } cx /= n; cy /= n; cz /= n
  let s = 0
  for (let t = from; t < m.i.length; t += 3) {
    const [a, b, c] = [m.i[t] * 3, m.i[t + 1] * 3, m.i[t + 2] * 3]
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2]
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    s += nx * ((P[a] + P[b] + P[c]) / 3 - cx) + ny * ((P[a + 1] + P[b + 1] + P[c + 1]) / 3 - cy) + nz * ((P[a + 2] + P[b + 2] + P[c + 2]) / 3 - cz)
  }
  if (s < 0) for (let t = from; t < m.i.length; t += 3) { const x = m.i[t + 1]; m.i[t + 1] = m.i[t + 2]; m.i[t + 2] = x }
  return m
}
function loft(secs, color, { n = 36, caps = true, e = 2 } = {}) {
  const m = mesh(color), R = secs.length
  for (const s of secs) { const ex = 2 / (s.e || e)
    for (let k = 0; k < n; k++) { const t = k / n * TAU, co = Math.cos(t), si = Math.sin(t)
      m.p.push((s.cx || 0) + s.rx * Math.sign(co) * Math.abs(co) ** ex, s.y, (s.cz || 0) + s.rz * Math.sign(si) * Math.abs(si) ** ex) } }
  for (let j = 0; j < R - 1; j++) for (let k = 0; k < n; k++) { const a = j * n + k, b = j * n + (k + 1) % n, c = (j + 1) * n + k, d = (j + 1) * n + (k + 1) % n; m.i.push(a, b, c, b, d, c) }
  orient(m)
  if (caps) for (const [j, nb] of [[0, 1], [R - 1, R - 2]]) {
    const s = secs[j], ci = m.p.length / 3, from = m.i.length; m.p.push(s.cx || 0, s.y, s.cz || 0)
    for (let k = 0; k < n; k++) m.i.push(ci, j * n + k, j * n + (k + 1) % n)
    const dir = s.y - secs[nb].y; let sum = 0                          /* cap normal must point away from its neighbour */
    for (let t = from; t < m.i.length; t += 3) { const [a, b, c] = [m.i[t] * 3, m.i[t + 1] * 3, m.i[t + 2] * 3]
      sum += (m.p[b + 2] - m.p[a + 2]) * (m.p[c] - m.p[a]) - (m.p[b] - m.p[a]) * (m.p[c + 2] - m.p[a + 2]) }
    if (sum * dir < 0) for (let t = from; t < m.i.length; t += 3) { const x = m.i[t + 1]; m.i[t + 1] = m.i[t + 2]; m.i[t + 2] = x }
  }
  return m
}
function ell(cx, cy, cz, rx, ry, rz, color, keep, seg = 28, st = 20) {
  const secs = []
  for (let j = 0; j <= st; j++) { const f = j / st * Math.PI; secs.push({ y: cy + ry * Math.cos(f), rx: rx * Math.sin(f), rz: rz * Math.sin(f), cx, cz }) }
  const m = loft(secs, color, { n: seg, caps: false })
  if (keep) { const I = []
    for (let t = 0; t < m.i.length; t += 3) { let x = 0, y = 0, z = 0
      for (let q = 0; q < 3; q++) { x += m.p[m.i[t + q] * 3]; y += m.p[m.i[t + q] * 3 + 1]; z += m.p[m.i[t + q] * 3 + 2] }
      x = (x / 3 - cx) / rx; y = (y / 3 - cy) / ry; z = (z / 3 - cz) / rz; const l = Math.hypot(x, y, z) || 1
      if (keep(x / l, y / l, z / l)) I.push(m.i[t], m.i[t + 1], m.i[t + 2]) }
    m.i = I }
  return m
}
function place(m, ang, tx, ty, tz) {                 /* rotate about z, then translate */
  const c = Math.cos(ang), s = Math.sin(ang)
  for (let k = 0; k < m.p.length; k += 3) { const x = m.p[k], y = m.p[k + 1]; m.p[k] = x * c - y * s + tx; m.p[k + 1] = x * s + y * c + ty; m.p[k + 2] += tz }
  return m
}
function at(secs, y) {                               /* interpolate a section list at height y */
  const s = [...secs].sort((a, b) => a.y - b.y)
  if (y <= s[0].y) return s[0]; if (y >= s[s.length - 1].y) return s[s.length - 1]
  for (let i = 0; i < s.length - 1; i++) if (y <= s[i + 1].y) { const t = (y - s[i].y) / (s[i + 1].y - s[i].y), l = k => (s[i][k] || 0) + ((s[i + 1][k] || 0) - (s[i][k] || 0)) * t
    return { y, rx: l('rx'), rz: l('rz'), cx: l('cx'), cz: l('cz') } }
}
const slice = (secs, y0, y1, grow, st = 9) => Array.from({ length: st + 1 }, (_, i) => { const y = y1 - (y1 - y0) * i / st, s = at(secs, y); return { y, rx: s.rx + grow, rz: s.rz + grow, cx: s.cx, cz: s.cz } })

/* ---------- the two bodies ---------- */
const SPEC = {
  male: {
    head: { cy: 168, rx: 7.6, ry: 10.8, rz: 9.4, cz: .5,
      prof: [[10.8, .5, .5, .5], [10, 3.8, 4.8, .4], [8, 6.2, 7.8, .4], [5, 7.4, 9, .4], [1.5, 7.6, 9.4, .5], [-2, 7.3, 9, .8], [-5, 6.3, 7.8, 1.4], [-7.5, 4.9, 6.2, 2.2], [-9.5, 3.3, 4.2, 2.7], [-10.6, 1.6, 2.4, 2.9]] },
    ed: 6.2, sh: [19.6, 143.2], hip: 93, h: 178,
    neck: [{ y: 163, rx: 4.9, rz: 5.1, cz: -.6 }, { y: 152, rx: 5.4, rz: 5.7, cz: -.8 }],
    torso: [{ y: 153, rx: 6, rz: 5.5, cz: -.6 }, { y: 150.5, rx: 9.8, rz: 6.8, cz: -.5 }, { y: 147.5, rx: 14.5, rz: 8.6 }, { y: 144.5, rx: 19.4, rz: 10 }, { y: 141, rx: 20.2, rz: 10.4 }, { y: 134, rx: 18.8, rz: 11.4, cz: .3 }, { y: 122, rx: 16.8, rz: 10.6 }, { y: 108, rx: 15.4, rz: 9.6 }, { y: 100, rx: 15.8, rz: 9.8 }, { y: 93, rx: 16.8, rz: 10.4, cz: -.4 }, { y: 87, rx: 17, rz: 10.2 }],
    legX: 8.8, leg: [{ y: 92, rx: 8.8, rz: 9.6 }, { y: 82, rx: 8.6, rz: 9.2 }, { y: 68, rx: 7.4, rz: 8.2 }, { y: 52, rx: 5.9, rz: 6.4 }, { y: 42, rx: 5.6, rz: 6.2 }, { y: 36, rx: 5.9, rz: 6.8, cz: -1.2 }, { y: 24, rx: 4.7, rz: 5.2, cz: -.8 }, { y: 12, rx: 3.5, rz: 3.9 }, { y: 6.5, rx: 3.7, rz: 4.1 }],
    foot: [9.2, 3.4, 4.5, 4.2, 3.6, 11.5],
    arm: [[0, 5], [-6, 4.8], [-16, 4.4], [-28, 3.9], [-30, 3.8], [-40, 3.4], [-52, 2.7]], hand: [[-52, 2.7, 2.3], [-56, 3.5, 2], [-62, 3.3, 1.9], [-67, 2.1, 1.4], [-69.5, .6, .6]], armAng: 8 * Math.PI / 180, delt: [4.6, 4.2, 4.6],
    hairKeep: (x, y, z) => z < -.2 ? y > -.55 : y > .52 - .6 * Math.min(1, Math.max(0, (Math.abs(x) - .5) / .3)), hairC: '#2a2420'
  },
  female: {
    head: { cy: 156, rx: 7, ry: 10, rz: 8.8, cz: .4,
      prof: [[10, .5, .5, .4], [9.3, 3.5, 4.5, .3], [7.4, 5.8, 7.3, .3], [4.6, 6.8, 8.4, .3], [1.4, 7, 8.8, .4], [-2, 6.7, 8.4, .7], [-4.8, 5.7, 7.3, 1.3], [-7, 4.2, 5.6, 2], [-8.8, 2.8, 3.8, 2.4], [-9.8, 1.4, 2.2, 2.6]] },
    ed: 5.9, sh: [17.6, 133], hip: 86, h: 166,
    neck: [{ y: 151, rx: 4, rz: 4.2, cz: -.8 }, { y: 140, rx: 4.5, rz: 4.7, cz: -.6 }],
    torso: [{ y: 140, rx: 5.1, rz: 4.7, cz: -.4 }, { y: 137.5, rx: 9.6, rz: 6.2 }, { y: 135, rx: 14.5, rz: 7.8 }, { y: 132.5, rx: 17.4, rz: 8.6 }, { y: 130, rx: 17.6, rz: 8.8 }, { y: 123, rx: 16, rz: 10.4, cz: .4 }, { y: 113, rx: 14.2, rz: 9.4 }, { y: 104, rx: 12.4, rz: 8.6 }, { y: 96, rx: 15.8, rz: 10.2, cz: -.8 }, { y: 90, rx: 17.4, rz: 11, cz: -1 }, { y: 85, rx: 17, rz: 10.4, cz: -.8 }],
    legX: 8.4, leg: [{ y: 88, rx: 8.6, rz: 9 }, { y: 80, rx: 8.4, rz: 8.8 }, { y: 66, rx: 7, rz: 7.6 }, { y: 50, rx: 5.2, rz: 5.8 }, { y: 42, rx: 5, rz: 5.7 }, { y: 36, rx: 5.3, rz: 6.2, cz: -1 }, { y: 26, rx: 4.2, rz: 4.7, cz: -.6 }, { y: 12, rx: 3, rz: 3.4 }, { y: 6.5, rx: 3.2, rz: 3.6 }],
    foot: [8.6, 3.2, 4.2, 3.6, 3.4, 10],
    arm: [[0, 4.5], [-6, 4.2], [-15, 3.8], [-26, 3.3], [-28, 3.3], [-37, 3], [-48, 2.3]], hand: [[-48, 2.3, 2], [-52, 3, 1.6], [-57, 2.8, 1.5], [-61, 1.8, 1.2], [-63.5, .5, .5]], armAng: 7 * Math.PI / 180, delt: [4, 4, 4.2],
    hairKeep: (x, y, z) => z < -.15 ? true : y > .56 - 1.7 * Math.min(1, Math.max(0, (Math.abs(x) - .45) / .3)), hairC: '#38281f'
  }
}

function buildBody(g, skinHex) {
  const S = SPEC[g], f = g === 'female', skin = hex(skinHex), M = []
  const lip = mixc(skin, [.72, .3, .32], .55), hair = hex(S.hairC), top = hex('#e3e6ec'), shorts = hex('#4a5467')
  const H = S.head, prof = H.prof.map(([dy, rx, rz, cz]) => ({ y: H.cy + dy, rx, rz, cz }))
  const zAt = (x, y) => { const s = at(prof, y); return s.cz + s.rz * Math.sqrt(Math.max(0, 1 - (x / s.rx) ** 2)) }
  /* body */
  M.push(loft(S.neck, skin, { n: 24 }))
  M.push(loft(S.torso, skin, { e: 2.3 }))
  for (const sd of [-1, 1]) {
    M.push(loft(S.leg.map(s => ({ ...s, cx: sd * S.legX })), skin, { n: 28 }))
    M.push(ell(sd * S.foot[0], S.foot[1], S.foot[2], S.foot[3], S.foot[4], S.foot[5], skin))
    const arm = [...S.arm.map(([y, r]) => ({ y, rx: r, rz: r * .95 })), ...S.hand.map(([y, rx, rz]) => ({ y, rx, rz }))]
    M.push(place(loft(arm, skin, { n: 22 }), sd * S.armAng, sd * S.sh[0], S.sh[1] - 2.4, 0))
    M.push(ell(sd * (S.sh[0] + .4), S.sh[1] - 4.8, 0, S.delt[0] - .4, S.delt[1] - .8, S.delt[2], skin))
    M.push(ell(sd * (H.rx - .1), H.cy - .2, H.cz - .5, .9, 2.1, 1.3, skin, null, 12, 10))      /* ears */
  }
  /* head + face */
  M.push(loft(prof, skin, { n: 40 }))
  const ex = S.ed / 2, ey = H.cy + 1.2
  for (const sd of [-1, 1]) {
    M.push(ell(sd * ex, ey, zAt(ex, ey) - .3, 1.25, .75, .65, hex('#f2eee9'), null, 14, 10))
    M.push(ell(sd * ex, ey, zAt(ex, ey) - .05, .74, .74, .5, hex('#2b1c14'), null, 14, 10))
    M.push(ell(sd * (ex + .2), ey + 2.6, zAt(ex, ey + 2.6) - .25, 1.9, f ? .22 : .3, .5, hair, null, 14, 8))
  }
  M.push(ell(0, ey - 3, zAt(0, ey - 3) + .3, 1, 2, 1.4, skin, null, 16, 12))                    /* nose */
  M.push(ell(0, ey - 7.2, zAt(0, ey - 7.2) - .1, f ? 2.4 : 2.2, f ? .8 : .65, .8, lip, null, 16, 8))
  /* hair */
  M.push(ell(0, H.cy + (f ? 1.5 : 2.2), H.cz - (f ? 3 : 2.6), H.rx + (f ? 1.2 : 1), H.ry + (f ? 1.1 : .9), H.rz + (f ? 1.1 : 1), hair, f ? null : (x, y) => y > -.3, 64, 44))
  if (f) M.push(ell(0, H.cy - 6, H.cz - 4.4, H.rx + 1.9, 15, 6.6, hair, (x, y, z) => z < .05, 64, 40))
  /* plain base outfit: shorts (+ a bandeau top for the female model) */
  if (f) {
    M.push(loft(slice(S.torso, 114, 128, .55, 8), top, { e: 2.3, caps: false }))
  }
  M.push(loft(slice(S.torso, 90, 104, .6, 5), shorts, { e: 2.3, caps: false }))
  for (const sd of [-1, 1]) M.push(loft(slice(S.leg.map(s => ({ ...s, cx: sd * S.legX })), 70, S.leg[0].y - 1, .6, 7), shorts, { n: 28, caps: false }))
  return M
}

/* ---------- WebGL ---------- */
const VS = `attribute vec3 aP;attribute vec3 aN;attribute vec3 aC;uniform mat4 uMVP;uniform mat3 uNM;varying vec3 vN;varying vec3 vC;varying vec3 vL;
void main(){vN=uNM*aN;vC=aC;vL=aP;gl_Position=uMVP*vec4(aP,1.);}`
const FS = `precision mediump float;varying vec3 vN;varying vec3 vC;varying vec3 vL;uniform float uMode;
void main(){
 if(uMode>.5){float r=length(vL.xz)/50.;gl_FragColor=vec4(0.,0.,0.,.32*pow(1.-clamp(r,0.,1.),2.));return;}
 vec3 n=normalize(vN);if(!gl_FrontFacing)n=-n;vec3 base=pow(vC,vec3(2.2));
 vec3 l1=normalize(vec3(-.45,.75,.75));vec3 l2=normalize(vec3(.8,.15,.55));vec3 v=vec3(0.,0.,1.);
 float d1=max(dot(n,l1),0.),d2=max(dot(n,l2),0.);
 vec3 amb=mix(vec3(.24,.22,.24),vec3(.46,.50,.58),.5+.5*n.y);
 vec3 col=base*(amb+vec3(1.,.96,.9)*d1*.62+vec3(.55,.65,.85)*d2*.22);
 float sp=pow(max(dot(n,normalize(l1+v)),0.),28.)*.10;
 float rim=pow(1.-max(dot(n,v),0.),3.)*.16;
 col+=vec3(sp)+vec3(.7,.8,1.)*rim*(base*.5+.5);
 gl_FragColor=vec4(pow(col,vec3(1./2.2)),1.);}`

function normals(P, I) {
  const N = new Float32Array(P.length)
  for (let t = 0; t < I.length; t += 3) { const [a, b, c] = [I[t] * 3, I[t + 1] * 3, I[t + 2] * 3]
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2]
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    for (const q of [a, b, c]) { N[q] += nx; N[q + 1] += ny; N[q + 2] += nz } }
  for (let k = 0; k < N.length; k += 3) { const l = Math.hypot(N[k], N[k + 1], N[k + 2]) || 1; N[k] /= l; N[k + 1] /= l; N[k + 2] /= l }
  return N
}
const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s } return o }

export class Stage3D {
  constructor(canvas) {
    this.cv = canvas
    const gl = this.gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: true })
    if (!gl) throw new Error('WebGL not available')
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o }
    const pr = this.pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr)
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr))
    gl.useProgram(pr); this.a = ['aP', 'aN', 'aC'].map(n => gl.getAttribLocation(pr, n)); this.u = Object.fromEntries(['uMVP', 'uNM', 'uMode'].map(n => [n, gl.getUniformLocation(pr, n)]))
    const dp = [0, .05, 0], di = []; for (let k = 0; k < 40; k++) { const t = k / 40 * TAU; dp.push(Math.cos(t) * 50, .05, Math.sin(t) * 50); di.push(0, 1 + k, 1 + (k + 1) % 40) }
    this.disc = this.upload(new Float32Array(dp), new Float32Array(40 * 3 + 3).map((_, i) => (i % 3 === 1 ? 1 : 0)), new Float32Array(dp.length), new Uint16Array(di))
    this.key = ''
  }
  upload(P, N, C, I) {
    const gl = this.gl, b = (d, tg = gl.ARRAY_BUFFER) => { const o = gl.createBuffer(); gl.bindBuffer(tg, o); gl.bufferData(tg, d, gl.STATIC_DRAW); return o }
    return { p: b(P), n: b(N), c: b(C), i: b(I, gl.ELEMENT_ARRAY_BUFFER), count: I.length }
  }
  use(g, skin) {
    const key = g + skin; if (key === this.key) return
    const parts = buildBody(g, SKINS[skin][1]); let np = 0, ni = 0; for (const m of parts) { np += m.p.length; ni += m.i.length }
    const P = new Float32Array(np), C = new Float32Array(np), I = new Uint16Array(ni); let po = 0, io = 0
    for (const m of parts) { const base = po / 3; P.set(m.p, po); for (let k = 0; k < m.p.length; k += 3) C.set(m.c, po + k); for (let k = 0; k < m.i.length; k++) I[io + k] = m.i[k] + base; po += m.p.length; io += m.i.length }
    this.body = this.upload(P, normals(P, I), C, I); this.key = key; this.g = g
  }
  draw(b, mode) {
    const gl = this.gl; gl.uniform1f(this.u.uMode, mode)
    ;[b.p, b.n, b.c].forEach((buf, k) => { gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(this.a[k]); gl.vertexAttribPointer(this.a[k], 3, gl.FLOAT, false, 0, 0) })
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.i); gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_SHORT, 0)
  }
  /* view = { yaw (rad), cy (cm), vh (visible height, cm) }; returns item anchor points in canvas pixels */
  render({ yaw, cy, vh }) {
    const gl = this.gl, W = this.cv.width, Hh = this.cv.height, S = SPEC[this.g]
    gl.viewport(0, 0, W, Hh); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST)
    const tn = vh / (2 * D), f = 1 / tn, asp = W / Hh, zn = 50, zf = 1500
    const Pm = new Float32Array([f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, -(zf + zn) / (zf - zn), -1, 0, 0, -2 * zf * zn / (zf - zn), 0])
    const V = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -cy, -D, 1])
    const c = Math.cos(yaw), s = Math.sin(yaw), Rm = new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1])
    gl.uniformMatrix4fv(this.u.uMVP, false, mul(Pm, mul(V, Rm))); gl.uniformMatrix3fv(this.u.uNM, false, new Float32Array([c, 0, -s, 0, 1, 0, s, 0, c]))
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); this.draw(this.disc, 1); gl.depthMask(true); gl.disable(gl.BLEND)
    this.draw(this.body, 0)
    const pxcm = Hh / vh
    const pj = (x, y, z) => { const wx = x * c + z * s, wz = -x * s + z * c, k = pxcm * D / (D - wz); return { x: W / 2 + wx * k, y: Hh / 2 - (y - cy) * k } }
    const [sx, sy] = S.sh, H = S.head, ey = H.cy + 1.2, ez = H.cz + H.rz * Math.sqrt(Math.max(0, 1 - (S.ed / 2 / H.rx) ** 2)) - .2
    const L = pj(-sx, sy, 0), R = pj(sx, sy, 0)
    return {
      body: { L, R, M: pj(0, sy, 0), H: pj(0, S.hip, 0), sw0: 2 * sx * pxcm },
      face: { fL: pj(-S.ed / 2, ey, ez), fR: pj(S.ed / 2, ey, ez), fCh: pj(0, ey, H.cz), ed0: S.ed * pxcm }
    }
  }
}

/* where the camera looks: zoom is 'full' or 'close' */
export const defaultZoom = type => (CLOTHES[type].cat === 'dresses' ? 'full' : 'close')
export function viewFor(g, type, zoom) {
  const S = SPEC[g], md = modeOf(type)
  if (zoom === 'full') return { cy: S.h / 2 + 2, vh: S.h + 28 }
  if (md === 'face') return { cy: S.head.cy + 1, vh: 46 }
  if (md === 'neck') return { cy: S.sh[1] - 4, vh: 62 }
  return { cy: S.sh[1] - 12, vh: 112 }
}
