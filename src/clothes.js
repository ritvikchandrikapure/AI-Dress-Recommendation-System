/* Real product photos (transparent PNGs).
   Shirts, dresses:  L/R = shoulder seam points in image pixels.
   Glasses, hats:    w = width in "eye distances", a = anchor pixel, dy = lift above the eyes (eye distances).
   Necklaces:        w = width in shoulder widths, dy = lift of the chain top above the shoulder line. */
const im = n => new URL(`./assets/clothes/${n}.png`, import.meta.url).href

export const CATS = {
  shirts: { label: 'Men’s Shirts', title: 'Pick your shirt', sub: 'Tap the shirt you want to try on.', body: true, mode: 'body', kind: 'shirt' },
  dresses: { label: 'Ladies’ Dresses', title: 'Pick your dress', sub: 'Tap the dress you want to try on.', body: true, mode: 'body', kind: 'dress' },
  glasses: { label: 'Sunglasses', title: 'Pick your sunglasses', sub: 'Tap the pair you want to try on.', body: false, mode: 'face', kind: 'glasses' },
  hats: { label: 'Hats & Caps', title: 'Pick your hat', sub: 'Tap the hat you want to try on.', body: false, mode: 'face', kind: 'hat' },
  necklaces: { label: 'Necklaces', title: 'Pick your necklace', sub: 'Tap the necklace you want to try on.', body: false, mode: 'neck', kind: 'necklace' }
}

export const CLOTHES = {
  brown: { cat: 'shirts', name: 'Brown Pinstripe Camp Shirt', short: 'Brown Pinstripe', src: im('brown'), L: [100, 72], R: [378, 72] },
  navy: { cat: 'shirts', name: 'Navy Stripe Camp Shirt', short: 'Navy Stripe', src: im('navy'), L: [52, 60], R: [308, 60] },
  teal: { cat: 'shirts', name: 'Teal Linen Camp Shirt', short: 'Teal Linen', src: im('teal'), L: [65, 70], R: [335, 70] },
  green: { cat: 'shirts', name: 'Sage Green Overshirt', short: 'Sage Overshirt', src: im('green'), L: [62, 88], R: [352, 88] },

  dress_floral: { cat: 'dresses', name: 'Black Floral Tie-Strap Midi Dress', short: 'Black Floral', src: im('dress_floral'), L: [65, 45], R: [228, 45] },
  dress_blue: { cat: 'dresses', name: 'Blue Ditsy Wrap Midi Dress', short: 'Blue Ditsy', src: im('dress_blue'), L: [48, 42], R: [196, 40] },

  shades_gold: { cat: 'glasses', name: 'Gold Rimless Sunglasses', short: 'Gold Rimless', src: im('shades_gold'), w: 2.3, dy: 0 },
  shades_silver: { cat: 'glasses', name: 'Silver Rimless Sunglasses', short: 'Silver Rimless', src: im('shades_silver'), w: 2.3, dy: 0 },
  shades_pink: { cat: 'glasses', name: 'Pink Gradient Sunglasses', short: 'Pink Gradient', src: im('shades_pink'), w: 2.3, dy: 0 },

  cap_white: { cat: 'hats', name: 'White Baseball Cap', short: 'White Cap', src: im('cap_white'), w: 3.1, a: [205, 118], dy: .8 },
  hat_fedora: { cat: 'hats', name: 'Red Fedora Hat', short: 'Red Fedora', src: im('hat_fedora'), w: 3.8, a: [215, 185], dy: .9 },
  chain_curb: { cat: 'necklaces', name: 'Gold Curb Chain', short: 'Gold Curb Chain', src: im('chain_curb'), w: .62, dy: .12 },
  chain_dollar: { cat: 'necklaces', name: 'Gold Dollar Pendant Chain', short: 'Dollar Pendant', src: im('chain_dollar'), w: .58, dy: .12 },
  chain_r: { cat: 'necklaces', name: 'Gold “R” Crown Pendant Chain', short: '“R” Crown Pendant', src: im('chain_r'), w: .58, dy: .12 },
  haar_bridal: { cat: 'necklaces', name: 'Bridal Gold Choker Necklace', short: 'Bridal Choker', src: im('haar_bridal'), w: .95, dy: .2 }
}

export const itemsOf = cat => Object.keys(CLOTHES).filter(k => CLOTHES[k].cat === cat)

export const IMGS = {}
export const loaded = Promise.all(Object.entries(CLOTHES).map(([k, v]) => new Promise(res => {
  const i = new Image(); i.onload = i.onerror = () => res(); i.src = v.src; IMGS[k] = i
})))
