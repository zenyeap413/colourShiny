/* Suspect roster + procedural SVG drawing.
   Style follows the title art: flat faceted shapes, no outlines, shading by darker
   same-hue patches, black oval eyes with a highlight, angular hair blocks. */
(function (root) {
  'use strict';

  // Scribble tokens: '{smile}' '{scribble}' '{heart}' are rendered as doodles.
  const CHARACTERS = [
    {
      id: 'gym', name: '阿肌', title: '自以為是的健身哥', heightCm: 184,
      bulk: 1.45, skin: '#eba27b', hair: 'buzz', hairColor: '#8a4a2a',
      shirt: '#f3efe6', pants: '#22345c', shoes: '#d64a3e', acc: ['tank', 'beard', 'tattoo', 'stripes'],
      scribbles: ['肌肉＞數字', '這題太簡單\n我不屑寫', '答案是：\n練腿日', '{scribble}\n我的二頭肌'],
    },
    {
      id: 'office', name: '小周', title: '很緊張的上班族', heightCm: 168,
      bulk: 0.9, skin: '#f2c09b', hair: 'side', hairColor: '#2a2320',
      shirt: '#f3efe6', jacket: '#22345c', pants: '#22345c', acc: ['suit', 'tie', 'glasses', 'nervous'],
      scribbles: ['對、對不起…', '可以先問\n主管嗎', '（手抖）\n？？？', '沒有樹字'],
    },
    {
      id: 'sleepy', name: '老吳', title: '一直打瞌睡的大叔', heightCm: 171,
      bulk: 1.3, skin: '#e9aa82', hair: 'bald', hairColor: '#6b5a4a',
      shirt: '#8fb3d9', pants: '#6b5a4a', acc: ['mustache', 'sleepyEyes', 'nightcap'],
      scribbles: ['zzZ…', '（口水印）', '明天再說', '{scribble}'],
    },
    {
      id: 'influencer', name: 'Mia', title: '很愛自拍的網紅', heightCm: 164,
      bulk: 0.85, skin: '#f6c3a3', hair: 'bob', hairColor: '#1f2236',
      shirt: '#d33a3a', coat: '#f1e6cf', pants: '#d33a3a', shoes: '#1f2236', acc: ['sunglasses', 'hoops', 'coat', 'skirt', 'lipstick'],
      scribbles: ['先拍一張📸', '#沒有數字\n#好抽象', '記得\n按讚訂閱', '{heart}{heart}'],
    },
    {
      id: 'poet', name: '墨白', title: '講話很文青的詩人', heightCm: 177,
      bulk: 0.85, skin: '#f0c3a0', hair: 'beret', hairColor: '#2a2320',
      shirt: '#3b3f4f', pants: '#2b2f3f', acc: ['scarf', 'goatee'],
      scribbles: ['數字，是\n城市的寂寞', '我看見了…\n霧', '這是\n抽象畫嗎', '點點\n皆是星辰'],
    },
    {
      id: 'grandma', name: '金花嬤', title: '過度熱情的阿嬤', heightCm: 150,
      bulk: 1.15, skin: '#efbf9a', hair: 'bun', hairColor: '#d7d7d7',
      shirt: '#c74b3e', pants: '#4a5a7a', acc: ['glasses', 'blush'],
      scribbles: ['乖孫\n吃飽沒', '我愛媽媽', '一坨\n（阿嬤眼花）', '{smile}\n呷飽未'],
    },
    {
      id: 'conspiracy', name: '阿強', title: '什麼都是陰謀的大哥', heightCm: 188,
      bulk: 1.05, skin: '#dda27c', hair: 'tinfoil', hairColor: '#3a2a20',
      shirt: '#3f6b4f', pants: '#3a4f7a', shoes: '#c98f22', acc: ['hoodie', 'mustache', 'paint'],
      scribbles: ['這是政府\n的測試', '數字被\n藏起來了！', '我什麼都\n不會說', '它們在\n看著我們'],
    },
    {
      id: 'student', name: '阿傑', title: '童心未泯的大學生', heightCm: 174,
      bulk: 0.95, skin: '#f2c09b', hair: 'cap', hairColor: '#2a2320',
      shirt: '#e6b23e', pants: '#2f6fbf', shoes: '#f3efe6', acc: ['blush'],
      scribbles: ['貓？', '{smile}', '莫有數字', '可以畫\n恐龍嗎'],
    },
    {
      id: 'coder', name: '阿碼', title: '三天沒睡的工程師', heightCm: 179,
      bulk: 1.0, skin: '#f0bf98', hair: 'curly', hairColor: '#c9572e',
      shirt: '#f3efe6', pants: '#7a4a32', acc: ['glasses', 'bowtie', 'suspenders', 'plaid', 'eyebags', 'nervous'],
      scribbles: ['undefined', '404\nNot Found', '在我電腦上\n看得到啊', 'NaN'],
    },
    {
      id: 'chef', name: '老蔡', title: '手藝自豪的主廚', heightCm: 173,
      bulk: 1.35, skin: '#e8a57a', hair: 'chef', hairColor: '#2a2320',
      shirt: '#fbf8f1', pants: '#2b2f3f', acc: ['mustache', 'apron'],
      scribbles: ['看起來像\n蔥油餅', '鹹度剛好', '一坨\n（五分熟）', '{scribble}\n加點胡椒'],
    },
  ];
  const BY_ID = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));

  const shade = (hex, k) => {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
    const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  };
  const NAVY = '#22345c';
  const INK = '#1d1f2b';
  const pts = (arr) => arr.map((p) => p.map((v) => +v.toFixed(2)).join(',')).join(' ');
  const poly = (arr, fill, extra) => `<polygon points="${pts(arr)}" fill="${fill}"${extra ? ' ' + extra : ''}/>`;

  // ---------- Figure drawing (viewBox 0 0 100 200, feet at y=200) ----------
  const HX = 50, HY = 30; // head centre

  // Faceted head outline (shared by human head and alien)
  const HEAD = [[-15, -17], [15, -17], [17, 1], [12, 15], [0, 19], [-12, 15], [-17, 1]].map(([x, y]) => [HX + x, HY + y]);

  function drawHairBack(c) {
    const hc = c.hairColor;
    if (c.hair === 'bob') return poly([[HX - 20, HY - 6], [HX - 14, HY - 21], [HX + 14, HY - 21], [HX + 20, HY - 6], [HX + 21, HY + 20], [HX + 12, HY + 22], [HX - 12, HY + 22], [HX - 21, HY + 20]], hc);
    if (c.hair === 'bun') return `<circle cx="${HX}" cy="${HY - 22}" r="9" fill="${hc}"/><circle cx="${HX - 2}" cy="${HY - 24}" r="4" fill="${shade(hc, 1.06)}"/>`;
    return '';
  }

  function drawHair(c) {
    const hc = c.hairColor, hd = shade(hc, 0.82);
    switch (c.hair) {
      case 'buzz':
        return poly([[HX - 17, HY - 2], [HX - 16, HY - 15], [HX - 8, HY - 22], [HX + 6, HY - 23], [HX + 16, HY - 16], [HX + 17, HY - 2], [HX + 12, HY - 11], [HX - 12, HY - 11]], hc)
          + poly([[HX + 6, HY - 23], [HX + 16, HY - 16], [HX + 17, HY - 2], [HX + 12, HY - 11]], hd);
      case 'side':
        return poly([[HX - 18, HY + 2], [HX - 17, HY - 14], [HX - 6, HY - 22], [HX + 10, HY - 21], [HX + 18, HY - 12], [HX + 17, HY - 2], [HX + 8, HY - 12], [HX - 4, HY - 9], [HX - 13, HY - 6], [HX - 14, HY + 4]], hc)
          + poly([[HX + 10, HY - 21], [HX + 18, HY - 12], [HX + 17, HY - 2], [HX + 8, HY - 12]], hd);
      case 'bald':
        return poly([[HX - 18, HY + 6], [HX - 18, HY - 4], [HX - 14, HY - 6], [HX - 14, HY + 6]], hc)
          + poly([[HX + 18, HY + 6], [HX + 18, HY - 4], [HX + 14, HY - 6], [HX + 14, HY + 6]], hc);
      case 'bob':
        return poly([[HX - 17, HY - 4], [HX - 13, HY - 19], [HX + 13, HY - 19], [HX + 17, HY - 4], [HX + 8, HY - 12], [HX - 6, HY - 10]], hc);
      case 'beret':
        return poly([[HX - 17, HY - 2], [HX - 16, HY - 13], [HX + 16, HY - 13], [HX + 17, HY - 2], [HX + 10, HY - 9], [HX - 10, HY - 9]], hc)
          + poly([[HX - 20, HY - 12], [HX - 10, HY - 22], [HX + 10, HY - 24], [HX + 22, HY - 16], [HX + 16, HY - 11], [HX - 16, HY - 9]], '#8e2b3a')
          + poly([[HX + 10, HY - 24], [HX + 22, HY - 16], [HX + 16, HY - 11]], '#6e1f2c')
          + `<rect x="${HX + 2}" y="${HY - 29}" width="3" height="6" fill="#8e2b3a"/>`;
      case 'bun':
        return poly([[HX - 17, HY + 2], [HX - 15, HY - 15], [HX - 4, HY - 20], [HX + 8, HY - 20], [HX + 16, HY - 14], [HX + 17, HY + 2], [HX + 10, HY - 10], [HX - 10, HY - 10]], hc)
          + poly([[HX + 8, HY - 20], [HX + 16, HY - 14], [HX + 17, HY + 2], [HX + 10, HY - 10]], hd);
      case 'tinfoil':
        return poly([[HX - 17, HY - 3], [HX - 15, HY - 14], [HX + 15, HY - 14], [HX + 17, HY - 3], [HX + 10, HY - 10], [HX - 10, HY - 10]], hc)
          + poly([[HX - 20, HY - 12], [HX - 6, HY - 40], [HX + 2, HY - 28], [HX + 9, HY - 38], [HX + 20, HY - 12]], '#c3cbd6')
          + poly([[HX - 6, HY - 40], [HX + 2, HY - 28], [HX - 2, HY - 12], [HX - 20, HY - 12]], '#e3e8ef')
          + poly([[HX + 9, HY - 38], [HX + 20, HY - 12], [HX + 6, HY - 12]], '#9aa4b3');
      case 'cap':
        return poly([[HX - 17, HY - 5], [HX - 15, HY - 18], [HX - 2, HY - 24], [HX + 12, HY - 21], [HX + 18, HY - 9], [HX + 17, HY - 5]], '#d64a3e')
          + poly([[HX + 12, HY - 21], [HX + 18, HY - 9], [HX + 17, HY - 5], [HX + 6, HY - 5]], '#b13a30')
          + poly([[HX - 17, HY - 7], [HX - 32, HY - 6], [HX - 31, HY - 2], [HX - 16, HY - 3]], '#b13a30')
          + poly([[HX + 13, HY - 4], [HX + 18, HY - 4], [HX + 18, HY + 4], [HX + 14, HY + 2]], c.hairColor);
      case 'curly': {
        let s = '';
        const blobs = [[-15, -6, 6], [-13, -15, 7], [-4, -20, 7.5], [7, -20, 7.5], [15, -14, 7], [17, -5, 6], [-17, 3, 4.5], [18, 3, 4.5], [0, -14, 6]];
        for (const [x, y, r] of blobs) s += `<circle cx="${HX + x}" cy="${HY + y}" r="${r}" fill="${hc}"/>`;
        return s + `<circle cx="${HX + 12}" cy="${HY - 18}" r="4" fill="${hd}"/><circle cx="${HX + 17}" cy="${HY - 8}" r="3.5" fill="${hd}"/>`;
      }
      case 'chef':
        return poly([[HX - 16, HY - 10], [HX - 16, HY - 18], [HX + 16, HY - 18], [HX + 16, HY - 10]], '#fbf8f1')
          + poly([[HX + 6, HY - 18], [HX + 16, HY - 18], [HX + 16, HY - 10], [HX + 6, HY - 10]], '#e6e0d3')
          + poly([[HX - 18, HY - 18], [HX - 20, HY - 30], [HX - 10, HY - 40], [HX + 2, HY - 42], [HX + 14, HY - 38], [HX + 20, HY - 28], [HX + 18, HY - 18]], '#fbf8f1')
          + poly([[HX + 2, HY - 42], [HX + 14, HY - 38], [HX + 20, HY - 28], [HX + 18, HY - 18], [HX + 6, HY - 18]], '#e6e0d3');
      default:
        return '';
    }
  }

  function drawFace(c) {
    const a = c.acc, sk = c.skin, skd = shade(sk, 0.86);
    const brow = shade(c.hair === 'bald' ? '#4a3a2a' : c.hairColor === '#d7d7d7' ? '#9a9a9a' : c.hairColor, 0.8);
    const parts = [];
    // nose + cheek facet
    parts.push(poly([[HX - 1, HY + 2], [HX + 3, HY + 8], [HX - 2, HY + 8]], skd));
    // eyes (grouped for the squint reaction)
    if (a.includes('sleepyEyes')) {
      parts.push(`<g class="eyes"><rect x="${HX - 10}" y="${HY - 1}" width="7" height="2.2" fill="${INK}"/><rect x="${HX + 3}" y="${HY - 1}" width="7" height="2.2" fill="${INK}"/></g>`);
    } else {
      parts.push(`<g class="eyes">
        <ellipse cx="${HX - 6.5}" cy="${HY - 1}" rx="2.7" ry="3.4" fill="${INK}"/><ellipse cx="${HX + 6.5}" cy="${HY - 1}" rx="2.7" ry="3.4" fill="${INK}"/>
        <circle cx="${HX - 5.6}" cy="${HY - 2.3}" r="0.9" fill="#fff"/><circle cx="${HX + 7.4}" cy="${HY - 2.3}" r="0.9" fill="#fff"/></g>`);
    }
    // brows: thick angular blocks; nervous characters get raised inner ends
    const nervous = a.includes('nervous') || a.includes('sleepyEyes');
    parts.push(poly(nervous
      ? [[HX - 11, HY - 7], [HX - 3, HY - 10], [HX - 3, HY - 8], [HX - 11, HY - 5]]
      : [[HX - 11, HY - 9], [HX - 3, HY - 7], [HX - 3, HY - 5], [HX - 11, HY - 7]], brow));
    parts.push(poly(nervous
      ? [[HX + 3, HY - 10], [HX + 11, HY - 7], [HX + 11, HY - 5], [HX + 3, HY - 8]]
      : [[HX + 3, HY - 7], [HX + 11, HY - 9], [HX + 11, HY - 7], [HX + 3, HY - 5]], brow));
    if (a.includes('eyebags')) parts.push(`<path d="M${HX - 9} ${HY + 3.5} h5 M${HX + 4} ${HY + 3.5} h5" stroke="#9a6b7a" stroke-width="1.2"/>`);
    if (a.includes('blush')) parts.push(`<ellipse cx="${HX - 11}" cy="${HY + 6}" rx="3.2" ry="1.8" fill="#ec7f6e" opacity=".6"/><ellipse cx="${HX + 11}" cy="${HY + 6}" rx="3.2" ry="1.8" fill="#ec7f6e" opacity=".6"/>`);
    if (a.includes('glasses')) {
      parts.push(`<g fill="none" stroke="${INK}" stroke-width="1.6"><circle cx="${HX - 6.5}" cy="${HY - 1}" r="5"/><circle cx="${HX + 6.5}" cy="${HY - 1}" r="5"/><path d="M${HX - 1.5} ${HY - 1} h3 M${HX - 11.5} ${HY - 2} l-5 -1 M${HX + 11.5} ${HY - 2} l5 -1"/></g>`);
    }
    // mouth
    if (a.includes('lipstick')) parts.push(poly([[HX - 3, HY + 11], [HX + 3, HY + 11], [HX + 1.5, HY + 13.5], [HX - 1.5, HY + 13.5]], '#c7353a'));
    else parts.push(`<path class="mouth" d="M${HX - 4} ${HY + 12} l4 -1.2 l4 1.2" stroke="#6a2a24" stroke-width="1.8" fill="none" stroke-linejoin="round"/>`);
    if (a.includes('beard')) {
      parts.push(poly([[HX - 17, HY + 1], [HX - 13, HY + 16], [HX - 4, HY + 22], [HX + 4, HY + 22], [HX + 13, HY + 16], [HX + 17, HY + 1], [HX + 11, HY + 7], [HX + 5, HY + 9], [HX, HY + 7], [HX - 5, HY + 9], [HX - 11, HY + 7]], c.hairColor));
      parts.push(poly([[HX + 4, HY + 22], [HX + 13, HY + 16], [HX + 17, HY + 1], [HX + 11, HY + 7], [HX + 6, HY + 14]], shade(c.hairColor, 0.82)));
      parts.push(`<path d="M${HX - 4} ${HY + 13} l4 -1 l4 1" stroke="#5b2a20" stroke-width="1.8" fill="none"/>`);
    }
    if (a.includes('mustache')) parts.push(poly([[HX - 10, HY + 11], [HX - 6, HY + 7], [HX, HY + 9], [HX + 6, HY + 7], [HX + 10, HY + 11], [HX + 5, HY + 10], [HX, HY + 11.5], [HX - 5, HY + 10]], c.hair === 'chef' || c.hair === 'bald' ? '#3a2a20' : shade(c.hairColor, 0.9)));
    if (a.includes('goatee')) parts.push(poly([[HX - 3, HY + 15], [HX + 3, HY + 15], [HX, HY + 21]], c.hairColor));
    if (a.includes('sunglasses')) parts.push(`<g><rect x="${HX - 15}" y="${HY - 21}" width="12" height="5.5" rx="2.2" fill="${NAVY}"/><rect x="${HX + 3}" y="${HY - 21}" width="12" height="5.5" rx="2.2" fill="${NAVY}"/><rect x="${HX - 3}" y="${HY - 19.5}" width="6" height="1.6" fill="${NAVY}"/></g>`);
    if (a.includes('hoops')) parts.push(`<circle cx="${HX - 17}" cy="${HY + 9}" r="3" fill="none" stroke="#e0a832" stroke-width="1.6"/><circle cx="${HX + 17}" cy="${HY + 9}" r="3" fill="none" stroke="#e0a832" stroke-width="1.6"/>`);
    if (a.includes('nervous')) parts.push(`<path d="M${HX + 21} ${HY - 18} l4 -5 M${HX + 24} ${HY - 11} l6 -2 M${HX - 21} ${HY - 18} l-4 -5" stroke="${NAVY}" stroke-width="1.8" stroke-linecap="round"/>`);
    return parts.join('');
  }

  function drawHead(c) {
    const sk = c.skin, skd = shade(sk, 0.88);
    const ears = poly([[HX - 17, HY - 3], [HX - 21, HY], [HX - 20, HY + 7], [HX - 16, HY + 7]], skd)
      + poly([[HX + 17, HY - 3], [HX + 21, HY], [HX + 20, HY + 7], [HX + 16, HY + 7]], skd);
    const facet = poly([[HX + 7, HY - 17], [HX + 15, HY - 17], [HX + 17, HY + 1], [HX + 12, HY + 15], [HX + 4, HY + 18], [HX + 9, HY + 4]], skd);
    const nightcap = c.acc.includes('nightcap')
      ? poly([[HX - 18, HY - 9], [HX - 10, HY - 22], [HX + 8, HY - 24], [HX + 30, HY - 4], [HX + 25, HY - 2], [HX + 10, HY - 12], [HX - 14, HY - 6]], '#6c8ebf')
        + `<circle cx="${HX + 29}" cy="${HY - 1}" r="4" fill="#fbf8f1"/>`
      : '';
    return `${drawHairBack(c)}${ears}${poly(HEAD, sk)}${facet}${drawHair(c)}${nightcap}${drawFace(c)}`;
  }

  // The impostor's true face beneath the mask
  function drawAlien() {
    const g = '#7fb069', gd = '#5f8f4f';
    const head = [[-13, -16], [13, -16], [16, 0], [10, 14], [0, 18], [-10, 14], [-16, 0]].map(([x, y]) => [HX + x, HY + y]);
    return `<g class="g-alien">${poly(head, g)}
      ${poly([[HX + 6, HY - 16], [HX + 13, HY - 16], [HX + 16, HY], [HX + 10, HY + 14], [HX + 3, HY + 17], [HX + 8, HY + 2]], gd)}
      <ellipse cx="${HX - 6.5}" cy="${HY + 1}" rx="5" ry="7.5" fill="${INK}" transform="rotate(25 ${HX - 6.5} ${HY + 1})"/>
      <ellipse cx="${HX + 6.5}" cy="${HY + 1}" rx="5" ry="7.5" fill="${INK}" transform="rotate(-25 ${HX + 6.5} ${HY + 1})"/>
      <ellipse cx="${HX - 8}" cy="${HY - 2.5}" rx="1.6" ry="2.2" fill="#fff"/><ellipse cx="${HX + 5}" cy="${HY - 2.5}" rx="1.6" ry="2.2" fill="#fff"/>
      <path d="M${HX - 3} ${HY + 12} h6" stroke="#2f4f2a" stroke-width="1.6"/></g>`;
  }

  function drawBody(c) {
    const a = c.acc, b = c.bulk;
    const sw = 30 * b + 8, ww = sw * 0.84; // shoulder / waist width
    const top = 52, waist = 120;
    const L = HX - sw / 2, R = HX + sw / 2, wl = HX - ww / 2, wr = HX + ww / 2;
    const shirt = c.shirt, shirtD = shade(shirt, 0.86);
    const sleeve = a.includes('tank') ? c.skin : a.includes('suit') ? c.jacket : a.includes('coat') ? c.coat : shirt;
    const sleeveD = shade(sleeve, 0.86);
    const aw = 8 * Math.max(1, b * 0.9);
    const parts = [];
    // ---- legs ----
    const lw = 10 * Math.max(1, b * 0.85);
    const legTop = a.includes('skirt') ? 140 : waist - 4;
    const legColor = a.includes('skirt') ? c.skin : c.pants;
    for (const side of [-1, 1]) {
      const x = side < 0 ? HX - lw - 1 : HX + 1;
      parts.push(`<rect x="${x}" y="${legTop}" width="${lw}" height="${194 - legTop}" fill="${legColor}"/>`);
      parts.push(`<rect x="${x + lw * 0.6}" y="${legTop}" width="${lw * 0.4}" height="${194 - legTop}" fill="${shade(legColor, 0.86)}"/>`);
      if (a.includes('stripes')) parts.push(`<rect x="${side < 0 ? x + 1 : x + lw - 3}" y="${legTop + 2}" width="2" height="${190 - legTop}" fill="#fbf8f1"/>`);
      if (a.includes('plaid')) for (let y = legTop + 6; y < 190; y += 9) parts.push(`<rect x="${x}" y="${y}" width="${lw}" height="1.6" fill="${shade(c.pants, 0.7)}"/>`);
      if (a.includes('plaid')) parts.push(`<rect x="${x + lw * 0.45}" y="${legTop}" width="1.6" height="${194 - legTop}" fill="${shade(c.pants, 0.7)}"/>`);
      if (a.includes('paint')) parts.push(`<path d="M${x + 3} ${150 + side * 8} l3 3 l-3 3 l-3 -3z" fill="#f2b84b"/><circle cx="${x + lw - 3}" cy="${168 - side * 6}" r="1.8" fill="#e8705b"/>`);
      if (a.includes('skirt')) parts.push(`<rect x="${x - 1}" y="166" width="${lw + 2}" height="28" fill="${c.shoes || INK}"/>`);
    }
    // shoes
    const shoe = c.shoes || '#2b2f3f';
    parts.push(poly([[HX - lw - 3, 200], [HX - lw - 3, 195], [HX - lw + 1, 192], [HX - 1, 192], [HX - 1, 200]], shoe));
    parts.push(poly([[HX + lw + 3, 200], [HX + lw + 3, 195], [HX + lw - 1, 192], [HX + 1, 192], [HX + 1, 200]], shoe));
    parts.push(`<rect x="${HX - lw - 3}" y="198" width="${lw + 2}" height="2" fill="${shade(shoe, 0.7)}"/><rect x="${HX + 1}" y="198" width="${lw + 2}" height="2" fill="${shade(shoe, 0.7)}"/>`);
    if (a.includes('skirt')) parts.push(poly([[wl + 1, waist - 6], [wr - 1, waist - 6], [wr + 4, 142], [wl - 4, 142]], c.pants));
    // ---- torso ----
    const torso = [[L, top + 7], [L + 6, top], [R - 6, top], [R, top + 7], [wr, waist], [wl, waist]];
    const torsoRight = [[HX + sw * 0.18, top], [R - 6, top], [R, top + 7], [wr, waist], [HX + ww * 0.22, waist]];
    parts.push(poly(torso, shirt));
    parts.push(poly(torsoRight, shirtD));
    if (a.includes('tank')) {
      parts.push(poly([[HX - 9, top], [HX + 9, top], [HX + 5, top + 12], [HX - 5, top + 12]], c.skin));
      parts.push(poly([[L, top + 7], [L + 6, top], [L + 9, top], [L + 4, top + 16]], c.skin));
      parts.push(poly([[R, top + 7], [R - 6, top], [R - 9, top], [R - 4, top + 16]], shade(c.skin, 0.88)));
      parts.push(`<ellipse cx="${HX - 6}" cy="${waist - 18}" rx="4" ry="2.5" fill="#d9cdb4"/><ellipse cx="${HX + 8}" cy="${waist - 10}" rx="3" ry="2" fill="#d9cdb4"/>`);
    }
    if (a.includes('suit')) {
      parts.push(poly([[L, top + 7], [L + 6, top], [HX - 3, top], [HX - 2, waist], [wl, waist]], c.jacket));
      parts.push(poly([[R, top + 7], [R - 6, top], [HX + 3, top], [HX + 2, waist], [wr, waist]], shade(c.jacket, 0.82)));
      parts.push(poly([[HX - 3, top], [HX - 9, top], [HX - 4, top + 24]], shade(c.jacket, 1.25)));
      parts.push(poly([[HX + 3, top], [HX + 9, top], [HX + 4, top + 24]], shade(c.jacket, 1.1)));
    }
    if (a.includes('coat')) {
      parts.push(poly([[L - 2, top + 7], [L + 5, top], [HX - 5, top], [HX - 6, 140], [wl - 6, 140]], c.coat));
      parts.push(poly([[R + 2, top + 7], [R - 5, top], [HX + 5, top], [HX + 6, 140], [wr + 6, 140]], shade(c.coat, 0.88)));
    }
    if (a.includes('hoodie')) {
      parts.push(poly([[HX - 14, top - 2], [HX + 14, top - 2], [HX + 9, top + 8], [HX - 9, top + 8]], shade(shirt, 0.78)));
      parts.push(`<rect x="${HX - 5}" y="${top + 6}" width="1.6" height="14" fill="#fbf8f1"/><rect x="${HX + 3.4}" y="${top + 6}" width="1.6" height="14" fill="#fbf8f1"/>`);
      parts.push(poly([[wl + 4, waist - 22], [wr - 4, waist - 22], [wr - 2, waist - 6], [wl + 2, waist - 6]], shade(shirt, 0.9)));
    }
    if (a.includes('suspenders')) {
      parts.push(`<rect x="${HX - 9}" y="${top}" width="3.2" height="${waist - top}" fill="#6a3c26"/><rect x="${HX + 6}" y="${top}" width="3.2" height="${waist - top}" fill="#55301f"/>`);
    }
    if (a.includes('tie')) {
      parts.push(poly([[HX - 2.5, top + 3], [HX + 2.5, top + 3], [HX + 3.5, top + 26], [HX, top + 31], [HX - 3.5, top + 26]], '#c7353a'));
    }
    if (a.includes('bowtie')) {
      parts.push(poly([[HX - 9, top + 1], [HX - 1, top + 4], [HX - 9, top + 8]], '#c7353a') + poly([[HX + 9, top + 1], [HX + 1, top + 4], [HX + 9, top + 8]], '#a92b30'));
      parts.push(`<rect x="${HX - 2}" y="${top + 2.5}" width="4" height="3.5" fill="#a92b30"/>`);
    }
    if (a.includes('scarf')) {
      parts.push(poly([[HX - 14, top - 1], [HX + 14, top - 1], [HX + 13, top + 6], [HX - 13, top + 6]], '#d9773a'));
      parts.push(poly([[HX + 5, top + 5], [HX + 12, top + 5], [HX + 14, top + 32], [HX + 7, top + 32]], '#b8602c'));
    }
    if (a.includes('apron')) {
      parts.push(poly([[HX - 13, top + 18], [HX + 13, top + 18], [HX + 15, waist + 14], [HX - 15, waist + 14]], '#e9e3d6'));
      parts.push(poly([[HX + 4, top + 18], [HX + 13, top + 18], [HX + 15, waist + 14], [HX + 6, waist + 14]], '#d6cfbf'));
      parts.push(`<circle cx="${HX - 5}" cy="${top + 40}" r="2" fill="#c98f22" opacity=".7"/><circle cx="${HX + 7}" cy="${top + 52}" r="1.6" fill="#c4523f" opacity=".6"/>`);
    }
    // ---- arms: in front of the torso, elbows out, hands at the placard edges ----
    const hx = 37, hy = 90; // hand position (placard spans x 13..87)
    const armPath = (sd) => `M${HX + sd * (sw / 2 - 3)} ${top + 4} L${HX + sd * (sw / 2 + 4)} ${top + 24} L${HX + sd * hx} ${hy}`;
    parts.push(`<path d="${armPath(-1)}" stroke="${sleeve}" stroke-width="${aw}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
    parts.push(`<path d="${armPath(1)}" stroke="${sleeveD}" stroke-width="${aw}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
    if (a.includes('tank') || a.includes('skirt')) {
      // bare forearms below the sleeve for short-sleeve looks
      const fa = (sd) => `M${HX + sd * (sw / 2 + 4)} ${top + 24} L${HX + sd * hx} ${hy}`;
      parts.push(`<path d="${fa(-1)}" stroke="${c.skin}" stroke-width="${aw * 0.92}" fill="none" stroke-linecap="round"/>`);
      parts.push(`<path d="${fa(1)}" stroke="${shade(c.skin, 0.88)}" stroke-width="${aw * 0.92}" fill="none" stroke-linecap="round"/>`);
    }
    if (a.includes('tattoo')) {
      parts.push(`<circle cx="${HX - sw / 2 - 1}" cy="${top + 14}" r="2.8" fill="${NAVY}"/><rect x="${HX - sw / 2 - 2.6}" y="${top + 15.8}" width="3.2" height="2.2" fill="${NAVY}"/>`);
      parts.push(`<path d="M${HX + sw / 2 + 1} ${top + 10} v8 M${HX + sw / 2 - 1.5} ${top + 12} h5 M${HX + sw / 2 - 2} ${top + 17} q3 3 6 0" stroke="${NAVY}" stroke-width="1.3" fill="none"/>`);
    }
    // neck sits beneath collars, scarves and hoods
    return `<rect x="${HX - 5}" y="${HY + 15}" width="10" height="9" fill="${shade(c.skin, 0.88)}"/>` + parts.join('');
  }

  // Returns SVG markup; impostors get a mask (their "human" head) over an alien face.
  function drawFigure(c, isImpostor) {
    const head = drawHead(c);
    const headwrap = isImpostor
      ? `<g class="g-headwrap">${drawAlien()}<g class="mask">${head}</g></g>`
      : `<g class="g-headwrap">${head}</g>`;
    return `<svg class="fig-svg" viewBox="0 0 100 200" preserveAspectRatio="xMidYMax meet" overflow="visible">
      <g class="g-body">${drawBody(c)}</g>${headwrap}</svg>`;
  }

  root.Characters = { CHARACTERS, BY_ID, drawFigure };
})(window);
