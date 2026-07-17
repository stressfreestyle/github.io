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

  /* ---- 太陽黄経と二十四節気 (JST基準) ----
   * 整数JDNはその日の正午UTCを指す。日本の暦日に合わせるため、
   * 節気区間・候はその日の正午JST(= JDN - 0.375)で評価し、
   * 節気入り日はその日のJST 0時〜24時の間に黄経15°境界を跨ぐかで判定。
   * 国立天文台 暦要項(JST)と日単位で一致することを確認済み。 */
  const SEKKI = ['春分', '清明', '穀雨', '立夏', '小満', '芒種', '夏至', '小暑',
    '大暑', '立秋', '処暑', '白露', '秋分', '寒露', '霜降', '立冬',
    '小雪', '大雪', '冬至', '小寒', '大寒', '立春', '雨水', '啓蟄'];
  function sunLonAt(jd) {
    const d = jd - 2451545;
    const g = mod(357.529 + 0.98560028 * d, 360) * DEG;
    const q = 280.459 + 0.98564736 * d;
    return mod(q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g), 360);
  }
  // その日の24:00 JST時点で評価 → 節気・候の入り日はその日から新区間に属する(暦の慣例)
  function sunLongitude(j) { return sunLonAt(j + 0.125); }
  function sekkiIndex(j) { return Math.floor(sunLongitude(j) / 15); }
  function sekkiName(idx) { return SEKKI[idx]; }
  // その日(JST)が節気入りの日なら節気名、そうでなければ null
  function sekkiOfDay(j) {
    const a = Math.floor(sunLonAt(j - 0.875) / 15); // 当日 0:00 JST
    const b = Math.floor(sunLonAt(j + 0.125) / 15); // 当日 24:00 JST
    return a !== b ? SEKKI[b] : null;
  }

  /* ---- 七十二候 (太陽黄経5°刻み・本朝七十二候) ---- */
  const KOU72 = ['雀始巣', '桜始開', '雷乃発声', '玄鳥至', '鴻雁北', '虹始見',
    '葭始生', '霜止出苗', '牡丹華', '蛙始鳴', '蚯蚓出', '竹笋生',
    '蚕起食桑', '紅花栄', '麦秋至', '螳螂生', '腐草為蛍', '梅子黄',
    '乃東枯', '菖蒲華', '半夏生', '温風至', '蓮始開', '鷹乃学習',
    '桐始結花', '土潤溽暑', '大雨時行', '涼風至', '寒蝉鳴', '蒙霧升降',
    '綿柎開', '天地始粛', '禾乃登', '草露白', '鶺鴒鳴', '玄鳥去',
    '雷乃収声', '蟄虫坏戸', '水始涸', '鴻雁来', '菊花開', '蟋蟀在戸',
    '霜始降', '霎時施', '楓蔦黄', '山茶始開', '地始凍', '金盞香',
    '虹蔵不見', '朔風払葉', '橘始黄', '閉塞成冬', '熊蟄穴', '鱖魚群',
    '乃東生', '麋角解', '雪下出麦', '芹乃栄', '水泉動', '雉始雊',
    '款冬華', '水沢腹堅', '鶏始乳', '東風解凍', '黄鶯睍睆', '魚上氷',
    '土脉潤起', '霞始靆', '草木萌動', '蟄虫啓戸', '桃始笑', '菜虫化蝶'];
  function kou(j) { return KOU72[Math.floor(sunLongitude(j) / 5)]; }

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

  /* ---- 言霊五十音暦 (冬至点起点・火水の会基準) ----
   * 出典: 「2026年暦データベース(火水の会 基準暦典)」TK_ANCHOR_03
   * 規則: 冬至点の瞬間を起点(ホ)とし、1音 = 7日7時間12分(365日÷50音)で
   * 五十連(kotodama.jsの記載順)を進める。第50音マは次の冬至点までを受け持つ。
   * 日への割当は、その日の正午(JST)時点の音とする。
   * 冬至点は太陽黄経270°通過の瞬間を計算(基準暦典の値と±数分で一致)。 */
  const ONKI = 7.3; // 1音 = 7日7時間12分
  const _wsCache = {};
  function winterSolsticeJD(year) {
    if (_wsCache[year]) return _wsCache[year];
    let lo = jdn(year, 12, 17) - 0.5, hi = jdn(year, 12, 26) + 0.5;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      const f = mod(sunLonAt(mid) - 270 + 180, 360) - 180;
      f < 0 ? lo = mid : hi = mid;
    }
    return _wsCache[year] = (lo + hi) / 2;
  }
  function gojuon(j, year) {
    const jd = j - 0.375; // その日の正午JST
    let ws = winterSolsticeJD(year);
    if (jd < ws) ws = winterSolsticeJD(year - 1);
    const idx = Math.min(Math.floor((jd - ws) / ONKI), 49);
    const s = window.Kotodama.SOUNDS[idx];
    return { kana: s.label, rei: s.rei, kasui50: s.kasui, def: s.def, idx };
  }

  /* ---- 旧暦2026年テーブル (宿曜・六曜) ----
   * 出典: 基準暦典(朔日時刻は国立天文台暦要項、宿曜は sukuyou.divination.page)
   * 宿曜: 各旧暦月の朔日に宿を配当し月内で27循環(旧暦法)。
   * ※原資料の注記どおり、旧3〜12月の朔日宿は「要確認」扱い。
   * 六曜: (旧暦月+旧暦日)から算出。テーブル範囲外の年は null。 */
  const SHUKU_ORDER = ['室', '壁', '奎', '婁', '胃', '昴', '畢', '觜', '参', '井', '鬼', '柳', '星',
    '張', '翼', '軫', '角', '亢', '氐', '房', '心', '尾', '箕', '斗', '女', '虚', '危'];
  const ROKUYO = ['先勝', '友引', '先負', '仏滅', '大安', '赤口'];
  const KYUREKI_2026 = [
    { start: '2026-01-19', days: 29, m: 12, shuku: null },  // 前年旧12月(宿データなし)
    { start: '2026-02-17', days: 30, m: 1, shuku: '室' },
    { start: '2026-03-19', days: 29, m: 2, shuku: '奎' },
    { start: '2026-04-17', days: 30, m: 3, shuku: '胃' },
    { start: '2026-05-17', days: 29, m: 4, shuku: '女' },
    { start: '2026-06-15', days: 29, m: 5, shuku: '参' },
    { start: '2026-07-14', days: 30, m: 6, shuku: '鬼' },
    { start: '2026-08-13', days: 29, m: 7, shuku: '角' },
    { start: '2026-09-11', days: 30, m: 8, shuku: '危' },
    { start: '2026-10-11', days: 29, m: 9, shuku: '女' },
    { start: '2026-11-09', days: 30, m: 10, shuku: '参' },
    { start: '2026-12-09', days: 30, m: 11, shuku: '斗' },
    { start: '2027-01-08', days: 29, m: 12, shuku: '虚' }
  ];
  for (const mo of KYUREKI_2026) mo.startJ = jdnFromISO(mo.start);
  function kyureki(j) {
    for (const mo of KYUREKI_2026) {
      if (j >= mo.startJ && j < mo.startJ + mo.days) {
        const day = j - mo.startJ + 1;
        return {
          m: mo.m, day,
          rokuyo: ROKUYO[(mo.m + day + 4) % 6],
          shuku: mo.shuku ? SHUKU_ORDER[(SHUKU_ORDER.indexOf(mo.shuku) + day - 1) % 27] : null
        };
      }
    }
    return null;
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
    const go = gojuon(j, y);
    const kyu = kyureki(j);
    return {
      iso, j, y, m, d,
      weekday: WEEKDAYS[weekday(j)],
      moonAge: age,
      moonPhase: moonPhaseLabel(age),
      sekkiDay: sekkiOfDay(j),                       // 節気入りの日のみ名前
      sekkiTerm: SEKKI[sekkiIndex(j)],               // その日が属する節気区間
      kou: kou(j),                                   // 七十二候
      // 宿: 旧暦法テーブル(2026旧暦年)があれば優先、なければ天文学的定法
      shuku: (kyu && kyu.shuku) ? kyu.shuku : shuku(j, opts.ayanamsa),
      shukuMethod: (kyu && kyu.shuku) ? '旧暦法' : '天文',
      rokuyo: kyu ? kyu.rokuyo : null,               // 六曜(テーブル範囲のみ)
      ganzhi: gz.name, element: gz.element, kasui: gz.kasui, yinyang: gz.yinyang,
      numerology: numerology(y, m, d),
      kana: go.kana, rei: go.rei, kasui50: go.kasui50,
      retro: mercuryRetro(j),
      gotobi: gotobi(y, m, d),
      monthPos: monthPos(y, m, d)
    };
  }

  window.Koyomi = {
    jdn, jdnFromISO, mod, WEEKDAYS, weekday,
    moonAge, moonPhaseLabel, SYNODIC,
    sunLongitude, sunLonAt, sekkiIndex, sekkiName, sekkiOfDay, SEKKI,
    kou, KOU72,
    moonLongitude, shuku, SHUKU27,
    ganzhi, STEMS, BRANCHES,
    numerology,
    gojuon, winterSolsticeJD, ONKI,
    kyureki, SHUKU_ORDER, ROKUYO,
    mercuryGeoLongitude, mercuryRetro,
    gotobi, monthPos, record
  };
})();
