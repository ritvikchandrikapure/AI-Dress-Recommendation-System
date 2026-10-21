import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getPose, points, facePoints, manualLm, smoothP } from './pose.js'
import { CLOTHES, CATS, itemsOf, loaded } from './clothes.js'
import { drawShirt, shirtURL, isFace, modeOf } from './shirt.js'
import { Stage3D, viewFor, defaultZoom, SKINS, MW, MH } from './model3d.js'

const SIZES = { S: ['86–91', 'Snug', 'Hugs your shoulders and chest.'], M: ['91–97', 'Regular', 'A comfortable everyday fit.'], L: ['97–104', 'Relaxed', 'A little extra room to move.'], XL: ['104–112', 'Oversized', 'Loose and boxy.'] }
const SC = { S: .9, M: .99, L: 1.08, XL: 1.17 }
const MATS = {
  cotton: { n: 'Cotton', v: [85, 45, 55], tip: 'Soft and breathable. Sits close to the body.' },
  linen: { n: 'Linen', v: [95, 35, 25], tip: 'Airy and a little boxy, with a natural crinkle.' },
  silk: { n: 'Silk', v: [60, 95, 40], tip: 'Glossy and clingy. It drapes closer to the body.' },
  denim: { n: 'Denim', v: [35, 20, 70], tip: 'Stiff and structured. It holds its shape away from you.' },
  wool: { n: 'Wool', v: [50, 60, 95], tip: 'Warm and fuzzy, with a bit of volume.' }
}

/* ---------- shared svg: fabric + material patterns ---------- */
const Defs = () => (
  <svg className="defs" width="0" height="0" aria-hidden="true"><defs>
    <pattern id="m-cotton" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="1.5" height="1.5" fill="#fff" opacity=".25" /></pattern>
    <pattern id="m-linen" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 .5H5" stroke="#fff" opacity=".35" /><path d="M.5 0V5" stroke="#000" opacity=".2" /></pattern>
    <pattern id="m-denim" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 5L5 0" stroke="#000" strokeWidth="1.4" opacity=".22" /></pattern>
    <pattern id="m-wool" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.3" fill="#fff" opacity=".3" /><circle cx="6" cy="6" r="1.3" fill="#000" opacity=".2" /></pattern>
    <linearGradient id="m-silk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".35" stopColor="#fff" stopOpacity=".5" /><stop offset=".6" stopColor="#000" stopOpacity=".12" /><stop offset="1" stopColor="#fff" stopOpacity=".25" /></linearGradient>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#000" stopOpacity=".25" /><stop offset=".3" stopColor="#000" stopOpacity="0" /><stop offset=".7" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".25" /></linearGradient>
  </defs></svg>
)

/* ---------- small animated parts ---------- */
const item = { hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0 } }
const Grid = ({ children }) => <motion.div className="g4" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: .08 } } }}>{children}</motion.div>
const Opt = ({ sel, cls = '', onClick, children }) => (
  <motion.button variants={item} whileHover={{ y: -4 }} whileTap={{ scale: .94 }} className={`opt ${cls} ${sel ? 'sel' : ''}`} onClick={onClick}>
    <motion.span className="in" animate={{ scale: sel ? 1.08 : 1 }} transition={{ type: 'spring', stiffness: 400, damping: 12 }}>{children}</motion.span>
  </motion.button>
)
const Cta = ({ cls = '', children, ...p }) => <motion.button className={`cta ${cls}`} whileHover={{ y: -2 }} whileTap={{ y: 4 }} {...p}>{children}</motion.button>
const Nav = ({ back, next, label = 'Continue' }) => (
  <div className="nav">{back ? <button className="ghost" onClick={back}>Back</button> : <i />}<Cta onClick={next}>{label}</Cta></div>
)
const Chip = ({ on, onClick, children }) => (
  <motion.button whileTap={{ scale: .93 }} className={`chip ${on ? 'on' : ''}`} onClick={onClick}>{on && <motion.i layoutId={'c' + children} className="chipbg" />}<span>{children}</span></motion.button>
)


const catOf = t => CLOTHES[t].cat
const LABELS = { pick: 'Item', size: 'Size', mat: 'Material', try: 'Try-on' }
const flowOf = cat => CATS[cat].body ? ['pick', 'size', 'mat', 'try'] : ['pick', 'try']

function Tape({ labels, step, set }) {
  return (
    <nav className="tape" aria-label="Progress" style={{ gridTemplateColumns: `repeat(${labels.length},1fr)` }}>
      <i className="fill" style={{ width: `${(step + .5) / labels.length * 100}%` }} />
      {labels.map((n, i) => (
        <button key={n} className={i === step ? 'on' : i < step ? 'done' : ''} onClick={() => i < step && set(i)}>
          <motion.b animate={{ scale: i === step ? 1.2 : 1 }} transition={{ type: 'spring', stiffness: 400, damping: 12 }}>{i < step ? '✓' : i + 1}</motion.b><span>{n}</span>
        </button>))}
    </nav>
  )
}

/* ---------- landing: choose a category ---------- */
function Landing({ pick }) {
  return (
    <section className="land">
      <h1>What would you like to try on?</h1>
      <p className="sub">Pick a category, choose your item, then try it on yourself with your camera or on a 3D male / female model.</p>
      <motion.div className="cats" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: .1 } } }}>
        {Object.keys(CATS).map(c => {
          const it = itemsOf(c); return (
            <motion.button key={c} variants={item} whileHover={{ y: -6 }} whileTap={{ scale: .96 }} className="cat" onClick={() => pick(c)}>
              <span className="catimg">{it.slice(0, 2).map((k, i) => <img key={k} src={CLOTHES[k].src} alt="" style={{ transform: it.length > 1 ? `translateX(${i ? 14 : -14}%) rotate(${i ? 5 : -5}deg)` : undefined }} />)}</span>
              <b>{CATS[c].label}</b><small>{it.length} styles</small>
            </motion.button>)
        })}
      </motion.div>
    </section>
  )
}

/* ---------- pick steps ---------- */
function PickType({ cat, cfg, set, go, home }) {
  return (<>
    <h1>{CATS[cat].title}</h1><p className="sub">{CATS[cat].sub}</p>
    <Grid>{itemsOf(cat).map(t => (
      <Opt key={t} sel={cfg.type === t} onClick={() => set('type', t)}><img className="thumb" src={CLOTHES[t].src} alt={CLOTHES[t].name} /><span>{CLOTHES[t].short}</span></Opt>))}
    </Grid>
    <Nav back={home} next={() => go(1)} />
  </>)
}
function PickSize({ cat, cfg, set, go }) {
  const z = SIZES[cfg.size]
  return (<>
    <h1>Choose a size</h1><p className="sub">The preview on the right resizes as you pick.</p>
    <Grid>{Object.keys(SIZES).map(k => <Opt key={k} cls="big" sel={cfg.size === k} onClick={() => set('size', k)}>{k}</Opt>)}</Grid>
    <AnimatePresence mode="wait"><motion.div key={cfg.size} className="info" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .18 }}>
      <b>{z[1]} fit.</b> {z[2]} Fits a {cat === 'dresses' ? 'bust' : 'chest'} of <b>{z[0]} cm</b>.</motion.div></AnimatePresence>
    <Nav back={() => go(0)} next={() => go(2)} />
  </>)
}
function PickMat({ cat, cfg, set, go }) {
  const m = MATS[cfg.mat]
  return (<>
    <h1>Select the material</h1><p className="sub">Material changes how the {CATS[cat].kind} looks and falls on you.</p>
    <Grid>{Object.keys(MATS).map(k => (
      <Opt key={k} cls="sw" sel={cfg.mat === k} onClick={() => set('mat', k)}>
        <svg viewBox="0 0 60 60" width="62" height="62"><rect width="60" height="60" rx="10" fill="#9fb0c6" /><rect width="60" height="60" rx="10" fill={`url(#m-${k})`} /></svg><span>{MATS[k].n}</span></Opt>))}
    </Grid>
    <div className="bars">{['Breathable', 'Drape', 'Warmth'].map((l, k) => <div key={l}>{l}<i><motion.b initial={{ width: 0 }} animate={{ width: m.v[k] + '%' }} transition={{ duration: .7 }} /></i></div>)}</div>
    <p className="info">{m.tip}</p>
    <Nav back={() => go(1)} next={() => go(3)} />
  </>)
}

/* ---------- last step: the item on YOU (live AI body / face tracking) ---------- */
function TryOn({ cfg }) {
  const vid = useRef(), cv = useRef(), stream = useRef(), raf = useRef(), lmr = useRef()
  const prev = useRef(null), opt = useRef(), man = useRef({ x: 0, y: 0, s: 1 }), aiS = useRef('loading'), trk = useRef(false)
  const [mode, setMode] = useState('boot'), [msg, setMsg] = useState('Starting camera…'), [m, setM] = useState({ x: 0, y: 0, s: 1 }), [tracked, setTracked] = useState(false), [manual, setManual] = useState(false), [flash, setFlash] = useState(0)
  opt.current = { ...cfg }; man.current = m
  const md = modeOf(cfg.type)
  const hint = md === 'face' ? 'Look at the camera and keep your face in view.' : md === 'neck' ? 'Step back so your neck and shoulders are in view.' : 'Step back so your shoulders are in view.'

  const paint = lm => {
    const el = vid.current, w = el.videoWidth, h = el.videoHeight; if (!w) return
    const c = cv.current; if (c.width !== w || c.height !== h) { c.width = w; c.height = h }
    const x = c.getContext('2d'); x.clearRect(0, 0, w, h)
    if (aiS.current === 'loading') return
    const useManual = aiS.current === 'off', raw = useManual ? manualLm(man.current) : lm || []
    let P = isFace(opt.current.type) ? facePoints(raw, w, h) : points(raw, w, h)
    const t = !!P && !useManual
    if (P && !useManual) P = prev.current = smoothP(prev.current, P)
    if (t !== trk.current) { trk.current = t; setTracked(t) }
    if (P) drawShirt(x, P, opt.current)
  }
  const loop = () => {
    if (vid.current.readyState >= 2) paint(aiS.current === 'ready' ? lmr.current.detectForVideo(vid.current, performance.now()).landmarks[0] : null)
    raf.current = requestAnimationFrame(loop)
  }
  const stop = () => { cancelAnimationFrame(raf.current); stream.current?.getTracks().forEach(t => t.stop()); stream.current = null }
  const startCam = async () => {
    setMode('boot'); setMsg('Starting camera…')
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 1280, height: 720 }, audio: false })
      const v = vid.current; v.srcObject = stream.current; await v.play(); setMode('cam'); loop()
    } catch { setMode('none'); setMsg('Camera not available. Please allow camera access and try again.') }
  }
  useEffect(() => {
    getPose('VIDEO').then(l => { lmr.current = l; aiS.current = 'ready' }).catch(() => { aiS.current = 'off'; setManual(true) })
    startCam(); return stop
  }, [])

  const snap = () => {
    const el = vid.current, w = cv.current.width, h = cv.current.height
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d')
    x.translate(w, 0); x.scale(-1, 1); x.drawImage(el, 0, 0, w, h); x.drawImage(cv.current, 0, 0)
    const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = `my-look-${cfg.type}.png`; a.click(); setFlash(f => f + 1)
  }
  const ready = mode === 'cam'
  return (
    <div className="tryon">
      <div className={`view ${ready ? 'mirror' : ''}`}>
        <video ref={vid} muted playsInline style={{ display: ready ? 'block' : 'none' }} />
        <canvas ref={cv} />
        {!ready && <div className="empty">{mode === 'none' ? null : <div className="spin" />}<p>{msg}</p></div>}
        {ready && <span className={`badge ${tracked ? 'ai' : ''}`}>{manual ? 'Manual fit' : tracked ? 'AI tracking' : 'Searching…'}</span>}
        {ready && <div className="hint">{manual ? 'AI tracking could not load. Use the sliders to fit it.' : hint}</div>}
        <AnimatePresence>{flash > 0 && <motion.div key={flash} className="flash" initial={{ opacity: .9 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: .5 }} />}</AnimatePresence>
      </div>
      <div className="row2">
        <Cta onClick={snap} disabled={!ready}>Capture look</Cta>
        {mode === 'none' && <button className="ghost" onClick={startCam}>Try camera again</button>}
      </div>
      {ready && manual && <div className="sliders">
        {[['x', 'Move left / right', -.3, .3, .01], ['y', 'Move up / down', -.3, .4, .01], ['s', 'Scale', .5, 1.8, .02]].map(([k, l, a, b, st]) => (
          <label key={k}>{l}<input type="range" min={a} max={b} step={st} value={m[k]} onChange={e => setM({ ...m, [k]: +e.target.value })} /></label>))}
      </div>}
    </div>
  )
}

/* ---------- choose how to try: on yourself, or on an AI model ---------- */
function TryChooser({ cat, choose }) {
  const sug = cat === 'dresses' ? 'female' : 'male'
  return (
    <div className="stagecard chooser">
      <h2>How would you like to try it?</h2>
      <button className="how" onClick={() => choose({ mode: 'self' })}>
        <span className="ico">📷</span><span><b>On yourself</b><small>Live camera with AI tracking</small></span>
      </button>
      <div className="how model">
        <span className="ico">🧍</span>
        <span><b>On an AI model</b><small>Check the fit on a 3D model you can turn. Choose a model:</small>
          <span className="gend">
            {['male', 'female'].map(g => <button key={g} onClick={() => choose({ mode: 'model', gender: g })}>{g === 'male' ? 'Male model' : 'Female model'}{g === sug && <i>Suggested</i>}</button>)}
          </span>
        </span>
      </div>
    </div>
  )
}

/* ---------- AI model: real-time 3D male / female (drag to turn) ---------- */
function ModelView({ cfg, gender }) {
  const gl = useRef(), ov = useRef(), raf = useRef(), live = useRef({}), cur = useRef(null), yaw = useRef(0), drag = useRef(null), stage = useRef()
  const [zoom, setZoom] = useState('auto'), [skin, setSkin] = useState(1), [flash, setFlash] = useState(0), [noGL, setNoGL] = useState(false)
  const eff = zoom === 'auto' ? defaultZoom(cfg.type) : zoom
  live.current = { cfg, gender, eff, skin }
  useEffect(() => { setZoom('auto'); cur.current = null }, [cfg.type, gender])
  useEffect(() => {
    try { stage.current = new Stage3D(gl.current) } catch { setNoGL(true); return }
    const draw = t => {
      const L = live.current, st = stage.current, tg = viewFor(L.gender, L.cfg.type, L.eff)
      cur.current = cur.current ? { cy: cur.current.cy + (tg.cy - cur.current.cy) * .14, vh: cur.current.vh + (tg.vh - cur.current.vh) * .14 } : tg
      st.use(L.gender, L.skin)
      const sway = drag.current ? 0 : Math.sin(t / 1800) * 3
      const P = st.render({ ...cur.current, yaw: (yaw.current + sway) * Math.PI / 180 })
      const c = ov.current.getContext('2d'); c.clearRect(0, 0, ov.current.width, ov.current.height)
      drawShirt(c, modeOf(L.cfg.type) === 'face' ? P.face : P.body, L.cfg)
      raf.current = requestAnimationFrame(draw)
    }
    loaded.then(() => { raf.current = requestAnimationFrame(draw) })
    return () => cancelAnimationFrame(raf.current)
  }, [])
  const down = e => { drag.current = { x: e.clientX, y0: yaw.current }; e.currentTarget.setPointerCapture(e.pointerId) }
  const move = e => { if (drag.current) yaw.current = Math.max(-40, Math.min(40, drag.current.y0 + (e.clientX - drag.current.x) * .35)) }
  const up = () => { drag.current = null }
  const snap = () => {
    const w = gl.current.width, h = gl.current.height, o = document.createElement('canvas'); o.width = w; o.height = h
    const x = o.getContext('2d'), g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f3f7fd'); g.addColorStop(1, '#cfdcee')
    x.fillStyle = g; x.fillRect(0, 0, w, h); x.drawImage(gl.current, 0, 0); x.drawImage(ov.current, 0, 0)
    const a = document.createElement('a'); a.href = o.toDataURL('image/png'); a.download = `model-look-${cfg.type}.png`; a.click(); setFlash(f => f + 1)
  }
  return (
    <div className="tryon">
      <div className="mv">
        <canvas ref={gl} width={MW * 1.2} height={MH * 1.2} />
        <canvas ref={ov} width={MW * 1.2} height={MH * 1.2} className="ovl" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onDoubleClick={() => { yaw.current = 0 }} />
        {noGL && <div className="empty"><p>3D is not supported in this browser.</p></div>}
        <span className="badge ai">3D model · {gender === 'male' ? 'Male' : 'Female'}</span>
        <button className="zoom" onClick={() => setZoom(eff === 'full' ? 'close' : 'full')}>{eff === 'full' ? 'Zoom in' : 'Full body'}</button>
        <div className="skins">{SKINS.map(([n, c], i) => <button key={n} title={n} className={skin === i ? 'on' : ''} style={{ background: c }} onClick={() => setSkin(i)} />)}</div>
        <small className="dragtip">Drag to turn · double-tap to reset</small>
        <AnimatePresence>{flash > 0 && <motion.div key={flash} className="flash" initial={{ opacity: .9 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: .5 }} />}</AnimatePresence>
      </div>
      <div className="row2"><Cta onClick={snap}>Capture look</Cta></div>
    </div>
  )
}

function TryPanel({ cat, cfg, set, back, home, tryAs, setTryAs }) {
  const body = CATS[cat].body, md = CATS[cat].mode
  const subTxt = !tryAs ? 'Choose on the right how you want to try it on.' : tryAs.mode === 'model' ? 'Check the fit on the 3D model. Drag to turn it, use zoom to look closer.' : (md === 'face' ? 'Look at the camera and keep your face in view.' : md === 'neck' ? 'Stand back so your neck and shoulders are in view.' : 'Stand back so your shoulders are in view.')
  return (<>
    <h1>Try it on</h1>
    <p className="sub">{subTxt} Change anything below and it updates live.</p>
    <p className="lbl">Try on</p><div className="chips">
      <Chip on={tryAs?.mode === 'self'} onClick={() => setTryAs({ mode: 'self' })}>Myself</Chip>
      <Chip on={tryAs?.mode === 'model' && tryAs.gender === 'male'} onClick={() => setTryAs({ mode: 'model', gender: 'male' })}>Male model</Chip>
      <Chip on={tryAs?.mode === 'model' && tryAs.gender === 'female'} onClick={() => setTryAs({ mode: 'model', gender: 'female' })}>Female model</Chip></div>
    <p className="lbl">Style</p><div className="chips">{itemsOf(cat).map(t => <Chip key={t} on={cfg.type === t} onClick={() => set('type', t)}>{CLOTHES[t].short}</Chip>)}</div>
    {body && <><p className="lbl">Size</p><div className="chips">{Object.keys(SIZES).map(s => <Chip key={s} on={cfg.size === s} onClick={() => set('size', s)}>{s}</Chip>)}</div>
      <p className="lbl">Material</p><div className="chips">{Object.keys(MATS).map(k => <Chip key={k} on={cfg.mat === k} onClick={() => set('mat', k)}>{MATS[k].n}</Chip>)}</div>
      <AnimatePresence mode="wait"><motion.div key={cfg.size + cfg.mat} className="info" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .18 }}>
        <b>{SIZES[cfg.size][1]} fit in {MATS[cfg.mat].n.toLowerCase()}.</b> {SIZES[cfg.size][2]} {MATS[cfg.mat].tip}</motion.div></AnimatePresence></>}
    <div className="nav"><button className="ghost" onClick={back}>Back</button><Cta onClick={home}>Start over</Cta></div>
  </>)
}

/* ---------- preview (all steps before try-on) ---------- */
function Form({ cat, cfg }) {
  const [, setReady] = useState(false)
  useEffect(() => { loaded.then(() => setReady(true)) }, [])
  const body = CATS[cat].body, url = shirtURL(cfg)
  return (
    <div className="stagecard">
      <motion.div className={`photo ${body ? '' : 'small'}`} animate={{ y: [0, -5, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
        <AnimatePresence mode="wait">
          <motion.img key={cfg.type + (body ? cfg.mat : '')} src={url} alt={CLOTHES[cfg.type].name} initial={{ y: -24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14 }} style={body ? { transform: `scaleX(${SC[cfg.size]})` } : undefined} />
        </AnimatePresence>
      </motion.div>
      <div className="tags"><span>{CLOTHES[cfg.type].name}</span>{body && <><span>Size {cfg.size}</span><span>{MATS[cfg.mat].n}</span></>}</div>
    </div>
  )
}

export default function App() {
  const [view, setView] = useState('landing'), [cat, setCat] = useState('shirts'), [step, setStep] = useState(0)
  const [cfg, setCfg] = useState({ type: 'brown', size: 'M', mat: 'cotton' }), [tryAs, setTryAs] = useState(null)
  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }))
  const home = () => { setView('landing'); setStep(0); setTryAs(null) }
  const pick = c => { setCat(c); setCfg(x => ({ ...x, type: itemsOf(c)[0] })); setStep(0); setTryAs(null); setView('flow') }
  const flow = flowOf(cat), cur = flow[step], P = { cat, cfg, set, go: setStep, home, tryAs, setTryAs }
  return (<>
    <Defs />
    <header className="top"><button className="logo" onClick={home}><span className="mark" />AI Dress recommendation</button><span className="tag">AI virtual try-on</span></header>
    {view === 'landing' ? <Landing pick={pick} /> : <>
      <Tape labels={flow.map(f => LABELS[f])} step={step} set={setStep} />
      <main className="grid">
        <AnimatePresence mode="wait">
          <motion.section key={cat + step} className="panel" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: .28 }}>
            {cur === 'pick' && <PickType {...P} />}{cur === 'size' && <PickSize {...P} />}{cur === 'mat' && <PickMat {...P} />}
            {cur === 'try' && <TryPanel {...P} back={() => setStep(flow.length - 2)} />}
          </motion.section>
        </AnimatePresence>
        <aside className="stage">{cur === 'try' ? (!tryAs ? <TryChooser cat={cat} choose={setTryAs} /> : tryAs.mode === 'self' ? <TryOn cfg={cfg} /> : <ModelView cfg={cfg} gender={tryAs.gender} />) : <Form cat={cat} cfg={cfg} />}</aside>
      </main>
    </>}
  </>)
}
