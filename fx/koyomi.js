/* =====================================================================
 * koyomi.js — 暦・天文計算エンジン
 * すべて日次粒度(UTC正午基準)。精度は日次分析に十分な簡易理論を採用。
 *  - 月齢・月の黄経(二十七宿) : 誤差 ±0.5日 / ±1° 程度
 *  - 太陽黄経(二十四節気)     : 誤差 ±0.02° (節気日判定に十分)
 *  - 日干支                    : 厳密 (1949-10-01 = 甲子 を基準)
 *  - 水星逆行                  : ケプラー軌道要素から計算、留の日 ±1日程度
 * ===================================================================== */
(function () {
  'use strict';

  const DEG = Math.PI / 180;
  const SYNODIC = 29.530588853;           // 朔望月
  const NEWMOON_JD = 2451550.26;          // 2000-01-06 18:14 UTC の朔

  function mod(a, n) { return ((a % n) + n) % n; }

  /* ---- ユリウス通日 (グレゴリオ暦、正午) ---- */
  function jdn(y, m, d) {
    const a = Math.floor((14 - m) / 12);
    const y2 = y + 4800 - a;
    const m2 = m + 12 * a - 3;
    return d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 +
      Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
  }
  function jdnFromISO(s) {
    const y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10);
    return jdn(y, m, d);
  }

  /* ---- 曜日 (JDN % 7 : 0=月 … 5=土, 6=日) ---- */
  const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];
  function weekday(j) { return j % 7; }

  /* ---- 月齢と月相 ---- */
  function moonAge(j) { return mod(j - NEWMOON_JD, SYNODIC); }
  function moonPhaseLabel(age) {
    if (age < 1.0 || age > SYNODIC - 1.0) return '新月';
    if (Math.abs(age - SYNODIC / 4) < 1.0) return '上弦';
    if (Math.abs(age - SYNODIC / 2) < 1.0) return '満月';
    if (Math.abs(age - SYNODIC * 3 / 4) < 1.0) return '下弦';
    return age < SYNODIC / 2 ? '満ちる期' : '欠ける期';
  }

  /* ---- 太陽黄経と二十四節気 ---- */
  // 黄経0°=春分 から15°刻み
  const SEKKI = ['春分', '清明', '穀雨', '立夏', '小満', '芒種', '夏至', '小暑',
    '大暑', '立秋', '処暑', '白露', '秋分', '寒露', '霜降', '立冬',
    '小雪', '大雪', '冬至', '小寒', '大寒', '立春', '雨水', '啓蟄'];
  function sunLongitude(j) {
    const d = j - 2451545;
    const g = mod(357.529 + 0.98560028 * d, 360) * DEG;
    const q = 280.459 + 0.98564736 * d;
    return mod(q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g), 360);
  }
  function sekkiIndex(j) { return Math.floor(sunLongitude(j) / 15); }
  function sekkiName(idx) { return SEKKI[idx]; }
  // その日が節気入りの日なら節気名、そうでなければ null
  function sekkiOfDay(j) {
    const a = sekkiIndex(j - 1), b = sekkiIndex(j);
    return a !== b ? SEKKI[b] : null;
  }

  /* ---- 月の黄経と二十七宿 (宿曜道: 牛宿を除く27宿) ---- */
  // 天文学的定法: 月の視黄経からアヤナムシャ(歳差差分、既定24°)を引き
  // 13°20′ごとに区切る。婁宿がサイデリアル白羊宮0°に対応。
  // ※宿曜の宿の割当は流派(旧暦法など)により異なるため設定で調整可能。
  const SHUKU27 = ['婁', '胃', '昴', '畢', '觜', '参', '井', '鬼', '柳', '星',
    '張', '翼', '軫', '角', '亢', '氐', '房', '心', '尾', '箕',
    '斗', '女', '虚', '危', '室', '壁', '奎'];
  function moonLongitude(j) {
    const d = j - 2451545;
    const Lp = 218.316 + 13.176396 * d;
    const M = mod(134.963 + 13.064993 * d, 360) * DEG;
    return mod(Lp + 6.289 * Math.sin(M), 360);
  }
  function shuku(j, ayanamsa) {
    const lam = mod(moonLongitude(j) - (ayanamsa == null ? 24 : ayanamsa), 360);
    return SHUKU27[Math.floor(lam / (360 / 27))];
  }

  /* ---- 日干支と五行 (火水の法則) ---- */
  // 基準: 1949-10-01 (JDN 2433191) = 甲子 → index = (JDN + 49) % 60
  const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const STEM_ELEM = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'];
  function ganzhi(j) {
    const idx = mod(j + 49, 60);
    const s = idx % 10, b = idx % 12;
    return {
      idx, name: STEMS[s] + BRANCHES[b],
      stem: STEMS[s], branch: BRANCHES[b],
      element: STEM_ELEM[s],
      yinyang: s % 2 === 0 ? '陽' : '陰',
      kasui: STEM_ELEM[s] === '火' ? '火' : (STEM_ELEM[s] === '水' ? '水' : null)
    };
  }

  /* ---- 数秘術 (年月日の各桁和を1〜9に還元) ---- */
  function numerology(y, m, d) {
    let n = String(y) + String(m).padStart(2, '0') + String(d).padStart(2, '0');
    let s = 0;
    for (const c of n) s += +c;
    while (s > 9) s = String(s).split('').reduce((a, c) => a + +c, 0);
    return s;
  }

  /* ---- 言霊五十音暦 ----
   * 古典五十音図(ゐ・ゑ含む50音)を1日1音で巡らせる50日周期。
   * ※標準的定義が存在しないため、基準日(既定: 2000-02-04 立春)と
   *   周期は設定タブから変更できる。行(10分類)と段(5分類)を返す。 */
  const KANA50 = ('あいうえお' + 'かきくけこ' + 'さしすせそ' + 'たちつてと' + 'なにぬねの' +
    'はひふへほ' + 'まみむめも' + 'やいゆえよ' + 'らりるれろ' + 'わゐうゑを').split('');
  const GYO = ['あ行', 'か行', 'さ行', 'た行', 'な行', 'は行', 'ま行', 'や行', 'ら行', 'わ行'];
  const DAN = ['あ段', 'い段', 'う段', 'え段', 'お段'];
  const GOJUON_ANCHOR = jdn(2000, 2, 4);
  function gojuon(j, anchorJ) {
    const idx = mod(j - (anchorJ == null ? GOJUON_ANCHOR : anchorJ), 50);
    return { kana: KANA50[idx], gyo: GYO[Math.floor(idx / 5)], dan: DAN[idx % 5], idx };
  }

  /* ---- 惑星位置 (簡易ケプラー軌道) と水星逆行 ---- */
  // NASA近似軌道要素 (J2000, /世紀)
  const ELEMENTS = {
    mercury: { a: 0.38709927, e: 0.20563593, I: 7.00497902, L: [252.25032350, 149472.67411175], w: [77.45779628, 0.16047689], O: [48.33076593, -0.12534081] },
    earth:   { a: 1.00000261, e: 0.01671123, I: -0.00001531, L: [100.46457166, 35999.37244981], w: [102.93768193, 0.32327364], O: [0, 0] }
  };
  function heliocentric(el, T) {
    const L = el.L[0] + el.L[1] * T;
    const w = el.w[0] + el.w[1] * T;
    const O = el.O[0] + el.O[1] * T;
    const M = mod(L - w, 360) * DEG;
    const e = el.e;
    let E = M;
    for (let i = 0; i < 10; i++) E = M + e * Math.sin(E);
    const xp = el.a * (Math.cos(E) - e);
    const yp = el.a * Math.sqrt(1 - e * e) * Math.sin(E);
    const om = (w - O) * DEG, Om = O * DEG, I = el.I * DEG;
    const cO = Math.cos(Om), sO = Math.sin(Om), co = Math.cos(om), so = Math.sin(om), cI = Math.cos(I), sI = Math.sin(I);
    return {
      x: xp * (co * cO - so * sO * cI) - yp * (so * cO + co * sO * cI),
      y: xp * (co * sO + so * cO * cI) + yp * (co * cO * cI - so * sO),
      z: xp * (so * sI) + yp * (co * sI)
    };
  }
  function mercuryGeoLongitude(j) {
    const T = (j - 2451545) / 36525;
    const p = heliocentric(ELEMENTS.mercury, T);
    const q = heliocentric(ELEMENTS.earth, T);
    return mod(Math.atan2(p.y - q.y, p.x - q.x) / DEG, 360);
  }
  // 逆行判定: 前日より黄経が減少していれば逆行 (±180°の巻き戻しを考慮)
  function mercuryRetro(j) {
    let d = mercuryGeoLongitude(j) - mercuryGeoLongitude(j - 1);
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d < 0;
  }

  /* ---- カレンダーアノマリー ---- */
  function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function gotobi(y, m, d) {
    // 五十日: 5,10,15,20,25 と月末
    return d % 5 === 0 || d === daysInMonth(y, m);
  }
  function monthPos(y, m, d) {
    const last = daysInMonth(y, m);
    if (d <= 3) return '月初';
    if (d >= last - 2) return '月末';
    return '月中';
  }

  /* ---- 1日分の暦レコードをまとめて生成 ---- */
  function record(iso, opts) {
    opts = opts || {};
    const y = +iso.slice(0, 4), m = +iso.slice(5, 7), d = +iso.slice(8, 10);
    const j = jdn(y, m, d);
    const age = moonAge(j);
    const gz = ganzhi(j);
    const go = gojuon(j, opts.gojuonAnchor);
    return {
      iso, j, y, m, d,
      weekday: WEEKDAYS[weekday(j)],
      moonAge: age,
      moonPhase: moonPhaseLabel(age),
      sekkiDay: sekkiOfDay(j),                       // 節気入りの日のみ名前
      sekkiTerm: SEKKI[sekkiIndex(j)],               // その日が属する節気区間
      shuku: shuku(j, opts.ayanamsa),
      ganzhi: gz.name, element: gz.element, kasui: gz.kasui, yinyang: gz.yinyang,
      numerology: numerology(y, m, d),
      kana: go.kana, gyo: go.gyo, dan: go.dan,
      retro: mercuryRetro(j),
      gotobi: gotobi(y, m, d),
      monthPos: monthPos(y, m, d)
    };
  }

  window.Koyomi = {
    jdn, jdnFromISO, mod, WEEKDAYS, weekday,
    moonAge, moonPhaseLabel, SYNODIC,
    sunLongitude, sekkiIndex, sekkiName, sekkiOfDay, SEKKI,
    moonLongitude, shuku, SHUKU27,
    ganzhi, STEMS, BRANCHES,
    numerology,
    gojuon, KANA50, GYO, DAN, GOJUON_ANCHOR,
    mercuryGeoLongitude, mercuryRetro,
    gotobi, monthPos, record
  };
})();
