/* =====================================================================
 * events.js — 主要な社会現象・経済イベント年表 (1999〜2025)
 * cat: crisis(危機) / policy(金融政策) / politics(政治) / disaster(災害) / market(市場)
 * ===================================================================== */
(function () {
  'use strict';
  window.FXEvents = [
    { date: '1999-01-01', cat: 'policy',   title: 'ユーロ導入' },
    { date: '1999-02-12', cat: 'policy',   title: '日銀ゼロ金利政策開始' },
    { date: '2000-03-10', cat: 'market',   title: 'ITバブル天井(NASDAQ最高値)' },
    { date: '2001-03-19', cat: 'policy',   title: '日銀 量的緩和開始' },
    { date: '2001-09-11', cat: 'crisis',   title: '米同時多発テロ' },
    { date: '2003-03-20', cat: 'politics', title: 'イラク戦争開戦' },
    { date: '2003-05-08', cat: 'policy',   title: '日本 大規模円売り介入期(〜04年3月)' },
    { date: '2005-08-08', cat: 'politics', title: '郵政解散' },
    { date: '2006-01-16', cat: 'market',   title: 'ライブドアショック' },
    { date: '2006-03-09', cat: 'policy',   title: '日銀 量的緩和解除' },
    { date: '2007-02-27', cat: 'market',   title: '上海ショック' },
    { date: '2007-08-09', cat: 'crisis',   title: 'パリバショック(サブプライム表面化)' },
    { date: '2008-03-16', cat: 'crisis',   title: 'ベアー・スターンズ救済' },
    { date: '2008-09-15', cat: 'crisis',   title: 'リーマン・ブラザーズ破綻' },
    { date: '2008-10-08', cat: 'policy',   title: '主要中銀 協調利下げ' },
    { date: '2009-03-09', cat: 'market',   title: '米株が金融危機の底' },
    { date: '2010-05-06', cat: 'market',   title: 'フラッシュクラッシュ/ギリシャ危機' },
    { date: '2010-09-15', cat: 'policy',   title: '日本 6年半ぶり円売り介入' },
    { date: '2011-03-11', cat: 'disaster', title: '東日本大震災' },
    { date: '2011-03-18', cat: 'policy',   title: 'G7協調円売り介入' },
    { date: '2011-08-05', cat: 'crisis',   title: '米国債格下げ(S&P)' },
    { date: '2011-10-31', cat: 'market',   title: '史上最高値75.32円・大規模介入' },
    { date: '2012-11-14', cat: 'politics', title: '衆院解散表明(アベノミクス始動)' },
    { date: '2013-04-04', cat: 'policy',   title: '黒田バズーカ(異次元緩和)' },
    { date: '2014-10-31', cat: 'policy',   title: '黒田バズーカ2(ハロウィン緩和)' },
    { date: '2015-01-15', cat: 'market',   title: 'スイスフランショック' },
    { date: '2015-08-24', cat: 'market',   title: 'チャイナショック' },
    { date: '2016-01-29', cat: 'policy',   title: '日銀 マイナス金利導入決定' },
    { date: '2016-06-24', cat: 'politics', title: '英EU離脱国民投票(Brexit)' },
    { date: '2016-11-09', cat: 'politics', title: '米大統領選 トランプ当選' },
    { date: '2018-02-06', cat: 'market',   title: 'VIXショック' },
    { date: '2018-07-06', cat: 'politics', title: '米中貿易戦争 対中関税発動' },
    { date: '2019-01-03', cat: 'market',   title: 'フラッシュクラッシュ(円急騰)' },
    { date: '2020-03-11', cat: 'crisis',   title: 'WHOパンデミック宣言(コロナショック)' },
    { date: '2020-03-23', cat: 'policy',   title: 'FRB 無制限量的緩和' },
    { date: '2020-11-07', cat: 'politics', title: '米大統領選 バイデン当選確実' },
    { date: '2022-02-24', cat: 'crisis',   title: 'ロシアのウクライナ侵攻' },
    { date: '2022-03-16', cat: 'policy',   title: 'FRB 利上げ開始(インフレ局面)' },
    { date: '2022-09-22', cat: 'policy',   title: '24年ぶり円買い介入' },
    { date: '2022-10-21', cat: 'policy',   title: '過去最大の円買い介入(151円台)' },
    { date: '2023-03-10', cat: 'crisis',   title: 'シリコンバレー銀行破綻' },
    { date: '2023-07-28', cat: 'policy',   title: '日銀 YCC運用柔軟化' },
    { date: '2024-03-19', cat: 'policy',   title: '日銀 マイナス金利解除' },
    { date: '2024-04-29', cat: 'policy',   title: '円買い介入(160円台)' },
    { date: '2024-08-05', cat: 'market',   title: '令和のブラックマンデー(円キャリー巻き戻し)' },
    { date: '2024-11-06', cat: 'politics', title: '米大統領選 トランプ再選' },
    { date: '2025-01-24', cat: 'policy',   title: '日銀 追加利上げ(0.5%)' },
    { date: '2025-04-02', cat: 'politics', title: '米 相互関税発表(関税ショック)' },
    { date: '2025-04-09', cat: 'market',   title: '相互関税90日停止で乱高下' }
  ];
  window.FXEventCats = {
    crisis: { label: '危機', color: '#e05d5d' },
    policy: { label: '金融政策', color: '#5d9de0' },
    politics: { label: '政治', color: '#c9a84c' },
    disaster: { label: '災害', color: '#9b6ee0' },
    market: { label: '市場', color: '#5dc08a' }
  };
})();
