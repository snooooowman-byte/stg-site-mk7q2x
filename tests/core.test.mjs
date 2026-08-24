/*
 * core.test.mjs — コアJSの単体テスト（設計書v1.0 8章）
 * 実行: node site/tests/core.test.mjs
 * 対象: util(norm/normSearch/safeUrl/imageUrl) ・ search.run ・ data(gvizパース/ヘッダー解決/ID重複先勝ち)
 * CJS(.js)を .mjs から default import（Nodeのinterop: default = module.exports）。
 */
import assert from 'node:assert/strict';
import util from '../assets/js/util.js';
import search from '../assets/js/search.js';
import data from '../assets/js/data.js';

let pass = 0, fail = 0;
const results = [];
function t(name, fn) {
  try { fn(); pass++; results.push('PASS ' + name); }
  catch (e) { fail++; results.push('FAIL ' + name + '  -> ' + (e && e.message ? e.message : e)); }
}

// ===== util: norm / normSearch（NFKC・かな折りたたみ） =====
t('norm: 全角英数→半角 + トリム', () => {
  assert.equal(util.norm('　ＡＢ１２３　'), 'AB123');
});
t('norm: 半角カナ→全角(NFKC)', () => {
  assert.equal(util.norm('ｶﾞﾊﾟｵ'), 'ガパオ');
});
t('normSearch: ひらがな→カタカナ折りたたみ（がぱお=ガパオ）', () => {
  assert.equal(util.normSearch('がぱお'), util.normSearch('ガパオ'));
});
t('normSearch: 英字は小文字化', () => {
  assert.equal(util.normSearch('ThaiSPOT'), 'thaispot');
});

// ===== util: safeUrl（悪性入力） =====
t('safeUrl: https は許可', () => {
  assert.equal(util.safeUrl('https://ok.example.com/a-b_c?x=1'), 'https://ok.example.com/a-b_c?x=1');
});
t('safeUrl: 前後空白はトリムして許可', () => {
  assert.equal(util.safeUrl('   https://ok.example.com   '), 'https://ok.example.com');
});
t('safeUrl: javascript: は null', () => {
  assert.equal(util.safeUrl('javascript:alert(1)'), null);
});
t('safeUrl: java<TAB>script: (スキーム分断) は null', () => {
  assert.equal(util.safeUrl('java\tscript:alert(1)'), null);
});
t('safeUrl: 制御文字混入 java<改行>script: は null', () => {
  assert.equal(util.safeUrl('java\nscript:alert(1)'), null);
});
t('safeUrl: data:text/html は null', () => {
  assert.equal(util.safeUrl('data:text/html;base64,PHNjcmlwdD4='), null);
});
t('safeUrl: //evil は null（スキーム無し）', () => {
  assert.equal(util.safeUrl('//evil.example.com'), null);
});
t('safeUrl: 先頭に空白/制御文字(NUL)を混ぜた https も除去後に許可', () => {
  const injected = ' 	' + String.fromCharCode(0) + 'https://ok.example.com';
  assert.equal(util.safeUrl(injected), 'https://ok.example.com');
})
t('safeUrl: data:image は image オプション時のみ許可', () => {
  assert.equal(util.safeUrl('data:image/png;base64,iVBORw0KGgo=', { image: true }), 'data:image/png;base64,iVBORw0KGgo=');
  assert.equal(util.safeUrl('data:image/png;base64,iVBORw0KGgo='), null); // 通常は不許可
});
// 実装設計書13-I-8: 制御文字は全位置除去・可視スペースは端のみtrim・内部に可視スペースが残る値はnull
t('safeUrl: 内部の半角スペースは静かな書き換えをせずnull', () => {
  assert.equal(util.safeUrl('https://ok.example.com/a b'), null);
});
t('safeUrl: 内部の全角スペースも同様にnull', () => {
  assert.equal(util.safeUrl('https://ok.example.com/a　b'), null);
});
t('safeUrl: 前後の全角スペースはtrimして許可（端は許可のまま維持）', () => {
  assert.equal(util.safeUrl('　https://ok.example.com　'), 'https://ok.example.com');
});

// ===== util: normalizeWalkMinutes（実装設計書13-I-7・徒歩分数の非数値混入） =====
t('normalizeWalkMinutes: 半角数字はそのまま許可', () => {
  assert.equal(util.normalizeWalkMinutes('5'), '5');
});
t('normalizeWalkMinutes: 全角数字は半角化して許可', () => {
  assert.equal(util.normalizeWalkMinutes('５'), '5');
});
t('normalizeWalkMinutes: 非数値混入（約5分等）はnull（表示自体を省略）', () => {
  assert.equal(util.normalizeWalkMinutes('約5分'), null);
  assert.equal(util.normalizeWalkMinutes('5分'), null);
  assert.equal(util.normalizeWalkMinutes(''), null);
  assert.equal(util.normalizeWalkMinutes(null), null);
});

// ===== util: imageUrl（Drive5形式 + 通常URL + 不正値） =====
const DID = '1AbcDEF_ghiJKLmno-pqrs123456';
const THUMB = 'https://drive.google.com/thumbnail?id=' + DID + '&sz=w800';
t('imageUrl: file/d/{id}/view → thumbnail w800', () => {
  assert.deepEqual(util.imageUrl('https://drive.google.com/file/d/' + DID + '/view'), { src: THUMB, ok: true });
});
t('imageUrl: open?id= → thumbnail w800', () => {
  assert.deepEqual(util.imageUrl('https://drive.google.com/open?id=' + DID), { src: THUMB, ok: true });
});
t('imageUrl: uc?id= → thumbnail w800', () => {
  assert.deepEqual(util.imageUrl('https://drive.google.com/uc?export=view&id=' + DID), { src: THUMB, ok: true });
});
t('imageUrl: thumbnail?id= → thumbnail w800', () => {
  assert.deepEqual(util.imageUrl('https://drive.google.com/thumbnail?id=' + DID), { src: THUMB, ok: true });
});
t('imageUrl: id単体 → thumbnail w800', () => {
  assert.deepEqual(util.imageUrl(DID), { src: THUMB, ok: true });
});
t('imageUrl: 通常の画像直URLはそのまま', () => {
  assert.deepEqual(util.imageUrl('https://cdn.example.com/x.jpg'), { src: 'https://cdn.example.com/x.jpg', ok: true });
});
t('imageUrl: 不正値はプレースホルダー + ok:false', () => {
  assert.deepEqual(util.imageUrl('javascript:alert(1)'), { src: util.PLACEHOLDER, ok: false });
  assert.deepEqual(util.imageUrl(''), { src: util.PLACEHOLDER, ok: false });
});

// ===== search.run（AND / 単一選択 / dropped / フリーワード） =====
function makeDb() {
  return {
    stores: [
      { id: 'S1', name: 'ガパオ食堂サワディー', description: '本格ガパオが看板', area: '新宿', station: '新宿駅', storeType: 'Restaurant', published: true },
      { id: 'S2', name: 'タイカフェ コップン', description: 'ゆったりカフェ', area: '渋谷', station: '渋谷駅', storeType: 'Cafe', published: true },
      { id: 'S3', name: '非公開の店', description: '出てはいけない', area: '新宿', station: '新宿三丁目駅', storeType: 'Restaurant', published: false },
    ],
    menus: [
      { id: 'M1', name: 'ガパオライス', category: 'RICE', published: true },
      { id: 'M2', name: '秘密メニュー', category: 'RICE', published: false },
    ],
    scenes: [{ id: 'SC1', name: '一人ランチ', published: true }],
    features: [{ id: 'F1', name: 'Thai SELECT認定', published: true }],
    storeMenus: [{ storeId: 'S1', otherId: 'M1' }], // ガパオライスはS1のみ提供（フリーワード一意化）
    storeScenes: [{ storeId: 'S1', otherId: 'SC1' }],
    storeFeatures: [{ storeId: 'S1', otherId: 'F1' }],
    texts: () => '', textsMap: {}, pages: [], ads: [], warnings: [],
  };
}
t('search: 公開のみ対象（非公開S3は除外）', () => {
  const r = search.run(makeDb(), { area: '新宿' });
  assert.deepEqual(r.stores.map(s => s.id), ['S1']);
  assert.equal(r.dropped.length, 0);
});
t('search: 異カテゴリAND（新宿 かつ ガパオライス）', () => {
  const r = search.run(makeDb(), { area: '新宿', dish: 'ガパオライス' });
  assert.deepEqual(r.stores.map(s => s.id), ['S1']);
});
t('search: type=Cafe 単一選択（S2のみ）', () => {
  const r = search.run(makeDb(), { type: 'Cafe' });
  assert.deepEqual(r.stores.map(s => s.id), ['S2']);
});
t('search: storeType末尾スペースを吸収して Restaurant 一致', () => {
  const db = makeDb();
  db.stores[0].storeType = 'Restaurant '; // 実データ由来の末尾スペース
  const r = search.run(db, { type: 'Restaurant' });
  assert.deepEqual(r.stores.map(s => s.id), ['S1']);
});
t('search: 存在しない条件は dropped + 全店舗フォールバック', () => {
  const r = search.run(makeDb(), { area: '存在しない街' });
  assert.deepEqual(r.dropped, [{ cat: 'area', val: '存在しない街' }]);
  assert.deepEqual(r.stores.map(s => s.id).sort(), ['S1', 'S2']); // 公開全店
});
t('search: フリーワード部分一致 + かな折りたたみ（がぱお→料理名ガパオライス）', () => {
  const r = search.run(makeDb(), { freeword: 'がぱお' });
  assert.deepEqual(r.stores.map(s => s.id), ['S1']);
});
t('search: フリーワードは紹介文も対象（部分一致）', () => {
  const r = search.run(makeDb(), { freeword: 'ゆったり' });
  assert.deepEqual(r.stores.map(s => s.id), ['S2']);
});
t('search: scene 条件（一人ランチ）', () => {
  const r = search.run(makeDb(), { scene: '一人ランチ' });
  assert.deepEqual(r.stores.map(s => s.id), ['S1']);
});
t('search: 条件なしは公開全店（見出しラベルも確認）', () => {
  const r = search.run(makeDb(), {});
  assert.equal(r.stores.length, 2);
  assert.equal(search.label({}, r.stores.length), 'すべてのお店（全2店舗）');
});
// 実装設計書13-I-5: label新表記（条件部全体を「」で囲む。設計書4章APIコントラクトの記載どおり）
t('search.label: 新表記「新宿 × ガパオライス」のお店（8店舗見つかりました）', () => {
  assert.equal(search.label({ area: '新宿', dish: 'ガパオライス' }, 8), '「新宿 × ガパオライス」のお店（8店舗見つかりました）');
});
t('search.label: フリーワードも他条件と同じ×連結で外側の「」1組にまとめる（二重引用にしない）', () => {
  assert.equal(search.label({ area: '新宿', freeword: 'がぱお' }, 3), '「新宿 × がぱお」のお店（3店舗見つかりました）');
});
t('search.label: 条件なしは現行フォールバック文言を維持', () => {
  assert.equal(search.label(null, 0), 'すべてのお店（全0店舗）');
});

// ===== data: gvizパース / ヘッダー解決 / ID重複先勝ち =====
function gv(headers, rows) {
  return {
    status: 'ok',
    table: {
      cols: headers.map((h, i) => ({ id: 'c' + i, label: h, type: 'string' })),
      rows: rows.map(r => ({ c: r.map(v => (v === null ? null : { v: v })) })),
    },
  };
}
t('data.parseGviz: 外殻 setResponse(...) を剥がして JSON.parse', () => {
  const raw = '/*O_o*/\ngoogle.visualization.Query.setResponse({"status":"ok","table":{"cols":[{"label":"A"}],"rows":[]}});';
  const obj = data._internal.parseGviz(raw);
  assert.equal(obj.status, 'ok');
});
t('data.gvizTable: ヘッダーは trim+NFKC 解決（Description 末尾スペース吸収）', () => {
  const tbl = data._internal.gvizTable(gv(['Store_ID', 'Description '], [['S1', '説明']]));
  assert.ok('Description' in tbl.index); // 末尾スペースを吸収
  assert.equal(data._internal.cellV(tbl.rows[0], tbl.index['Description']), '説明');
});
t('data.gvizTable: cols.label が空なら rows[0] をヘッダーに（列型混在フォールバック）', () => {
  const obj = {
    status: 'ok',
    table: {
      cols: [{ id: 'A', label: '', type: 'string' }, { id: 'B', label: '', type: 'string' }],
      rows: [{ c: [{ v: 'Store_ID' }, { v: 'Area' }] }, { c: [{ v: 'S9' }, { v: '池袋' }] }],
    },
  };
  const tbl = data._internal.gvizTable(obj);
  assert.ok('Store_ID' in tbl.index && 'Area' in tbl.index);
  assert.equal(tbl.rows.length, 1);
  assert.equal(data._internal.cellV(tbl.rows[0], tbl.index['Area']), '池袋');
});
t('data.buildDB: ID重複は先勝ち + warnings、空IDはスキップ、storeType/Descriptionを正しく解決', () => {
  const storesHeaders = ['Store_ID', 'Store_Name', 'Description ', 'Area', 'Nearest_Station', 'Walk_Minutes',
    'Address', 'Store_type', 'Google_Map_URL', 'Official_Website', 'Instagram_URL', 'Lunch', 'Dinner',
    'Store_Video', 'Exterior_Image', 'Food_Image', 'TikTok_URL', 'Video_Creator', 'Pran', 'Verified_Date', 'Published', 'Created_By'];
  const row = (id, name, desc, area, type, lunch, dinner, pub) =>
    [id, name, desc, area, '新宿駅', '3', 'addr', type, '', '', '', lunch, dinner, '', '', '', '', '', 'FREE', '2026/08/08', pub, 'Soa'];
  const tables = {
    Stores: data._internal.gvizTable(gv(storesHeaders, [
      row('S1', '店A', '紹介A', '新宿', 'Restaurant ', 'TRUE', 'FALSE', 'TRUE'),   // 先勝ち
      row('S1', '店A-重複', '紹介dup', '渋谷', 'Cafe', 'FALSE', 'TRUE', 'TRUE'),    // 捨てられる
      row('', '空ID', 'skip', 'X', 'Cafe', '', '', 'TRUE'),                        // スキップ
    ])),
    Menus: data._internal.gvizTable(gv(['Menu_ID', 'Menu_Name', 'Category', 'Published'], [['M1', 'ガパオライス', 'RICE', 'TRUE']])),
    Scenes: data._internal.gvizTable(gv(['Scene_ID', 'Scene_Name', 'Published'], [['SC1', '一人ランチ', 'TRUE']])),
    Features: data._internal.gvizTable(gv(['Feature_ID', 'Feature_Name', 'Published'], [['F1', 'Thai SELECT認定', 'TRUE']])),
    Store_Menus: data._internal.gvizTable(gv(['Store_ID', 'Menu_ID'], [['S1', 'M1']])),
    Store_Scenes: data._internal.gvizTable(gv(['Store_ID', 'Scene_ID'], [['S1', 'SC1']])),
    Store_Features: data._internal.gvizTable(gv(['Store_ID', 'Feature_ID'], [['S1', 'F1']])),
  };
  const db = data._internal.buildDB(tables);
  assert.equal(db.stores.length, 1, '重複・空IDを除いて1件');
  assert.equal(db.stores[0].name, '店A', '先勝ち');
  assert.equal(db.stores[0].storeType, 'Restaurant', 'storeType末尾スペースをトリム');
  assert.equal(db.stores[0].description, '紹介A', 'Description(末尾スペースヘッダ)を解決');
  assert.equal(db.stores[0].lunch, true);
  assert.equal(db.stores[0].dinner, false);
  assert.equal(db.stores[0].published, true);
  assert.ok(db.warnings.some(w => w.indexOf('Store_ID重複') >= 0), '重複warning記録');
  // Scenes/Features は実ヘッダー Scene_Name / Feature_Name で解決される
  assert.equal(db.scenes[0].name, '一人ランチ');
  assert.equal(db.features[0].name, 'Thai SELECT認定');
});
t('data.buildDB: 追加シート(Site_Texts/Pages/Ads)が無ければ空扱い + warnings', () => {
  const tables = {
    Stores: data._internal.gvizTable(gv(['Store_ID', 'Store_Name', 'Area', 'Published'], [['S1', '店', '新宿', 'TRUE']])),
    Menus: data._internal.gvizTable(gv(['Menu_ID', 'Menu_Name', 'Category', 'Published'], [])),
    Scenes: data._internal.gvizTable(gv(['Scene_ID', 'Scene_Name', 'Published'], [])),
    Features: data._internal.gvizTable(gv(['Feature_ID', 'Feature_Name', 'Published'], [])),
    Store_Menus: data._internal.gvizTable(gv(['Store_ID', 'Menu_ID'], [])),
    Store_Scenes: data._internal.gvizTable(gv(['Store_ID', 'Scene_ID'], [])),
    Store_Features: data._internal.gvizTable(gv(['Store_ID', 'Feature_ID'], [])),
  };
  const db = data._internal.buildDB(tables);
  assert.deepEqual(db.pages, []);
  assert.deepEqual(db.ads, []);
  assert.ok(db.warnings.some(w => w.indexOf('Site_Texts') >= 0));
});
t('data.buildDB: 追加シートにStores形状のテーブルが来た場合(gvizが存在しないシート名に既定タブを200で返す静かなフォールバック相当・設計書11章TODO3)、誤取り込みゼロ+新warningが3件積まれる', () => {
  const storesHeaders = ['Store_ID', 'Store_Name', 'Description ', 'Area', 'Nearest_Station', 'Walk_Minutes',
    'Address', 'Store_type', 'Google_Map_URL', 'Official_Website', 'Instagram_URL', 'Lunch', 'Dinner',
    'Store_Video', 'Exterior_Image', 'Food_Image', 'TikTok_URL', 'Video_Creator', 'Pran', 'Verified_Date', 'Published', 'Created_By'];
  const storesRow = ['S1', '店A', '紹介A', '新宿', '新宿駅', '3', 'addr', 'Restaurant ', '', '', '', 'TRUE', 'FALSE', '', '', '', '', '', 'FREE', '2026/08/08', 'TRUE', 'Soa'];
  const storesShaped = data._internal.gvizTable(gv(storesHeaders, [storesRow]));
  const tables = {
    Stores: storesShaped,
    Menus: data._internal.gvizTable(gv(['Menu_ID', 'Menu_Name', 'Category', 'Published'], [])),
    Scenes: data._internal.gvizTable(gv(['Scene_ID', 'Scene_Name', 'Published'], [])),
    Features: data._internal.gvizTable(gv(['Feature_ID', 'Feature_Name', 'Published'], [])),
    Store_Menus: data._internal.gvizTable(gv(['Store_ID', 'Menu_ID'], [])),
    Store_Scenes: data._internal.gvizTable(gv(['Store_ID', 'Scene_ID'], [])),
    Store_Features: data._internal.gvizTable(gv(['Store_ID', 'Feature_ID'], [])),
    // ⚠️ここが本題: 追加3シートに「Stores形状」がそのまま入ってきたケース（存在しないシート名→gvizが既定タブを返す）
    Site_Texts: storesShaped,
    Pages: storesShaped,
    Ads: storesShaped,
  };
  const db = data._internal.buildDB(tables);
  // ①誤取り込みゼロ
  assert.deepEqual(db.textsMap, {}, 'Site_TextsにStores行が文言として混入していない');
  assert.deepEqual(db.pages, [], 'PagesにStores行が混入していない');
  assert.deepEqual(db.ads, [], 'AdsにStores行が混入していない');
  // ②新warningが3件積まれる（テーブルnull時の「取得できませんでした」系warningとは別文言・別条件）
  assert.ok(db.warnings.some(w => w.indexOf('Site_Textsシートに列') >= 0), 'Site_Texts列未解決warning');
  assert.ok(db.warnings.some(w => w.indexOf('Pagesシートに列') >= 0), 'Pages列未解決warning');
  assert.ok(db.warnings.some(w => w.indexOf('Adsシートに列') >= 0), 'Ads列未解決warning');
});

// 実装設計書13-I-11: 回帰テスト拡充（gviz status:error／ネイティブbool・数値セル／全セルnull行／
//  追加シート部分一致ヘッダー）
t('data.gvizTable: status:error 応答は例外を投げる（gvizError付き・data.load()側のreject経路用）', () => {
  const obj = { status: 'error', errors: [{ message: 'INVALID_QUERY', detailed_message: '無効なシート名です' }] };
  assert.throws(() => data._internal.gvizTable(obj), (err) => {
    assert.equal(err.gvizError, true);
    assert.equal(err.message, '無効なシート名です');
    return true;
  });
});
t('data.buildDB: ネイティブbool(v:true)・数値(v:5)セルを正しく解釈する（gvizは列型により生値を返す）', () => {
  const storesHeaders = ['Store_ID', 'Store_Name', 'Area', 'Walk_Minutes', 'Published'];
  const tables = {
    Stores: data._internal.gvizTable(gv(storesHeaders, [
      ['S1', '店A', '新宿', 5, true], // Walk_Minutesは数値セル、Publishedはネイティブbool（文字列'TRUE'ではない）
    ])),
    Menus: data._internal.gvizTable(gv(['Menu_ID', 'Menu_Name', 'Category', 'Published'], [])),
    Scenes: data._internal.gvizTable(gv(['Scene_ID', 'Scene_Name', 'Published'], [])),
    Features: data._internal.gvizTable(gv(['Feature_ID', 'Feature_Name', 'Published'], [])),
    Store_Menus: data._internal.gvizTable(gv(['Store_ID', 'Menu_ID'], [])),
    Store_Scenes: data._internal.gvizTable(gv(['Store_ID', 'Scene_ID'], [])),
    Store_Features: data._internal.gvizTable(gv(['Store_ID', 'Feature_ID'], [])),
  };
  const db = data._internal.buildDB(tables);
  assert.equal(db.stores.length, 1);
  assert.equal(db.stores[0].published, true, 'v:trueのネイティブboolをpublished=trueに解釈');
  assert.equal(db.stores[0].walkMinutes, '5', '数値セル(v:5)を文字列"5"として保持');
});
t('data.buildDB: 全セルnull行はID空行として安全にスキップされる（gvizが空行を返すケース）', () => {
  const storesHeaders = ['Store_ID', 'Store_Name', 'Area', 'Published'];
  const tables = {
    Stores: data._internal.gvizTable(gv(storesHeaders, [
      [null, null, null, null], // 全セルnull
      ['S1', '店A', '新宿', 'TRUE'],
    ])),
    Menus: data._internal.gvizTable(gv(['Menu_ID', 'Menu_Name', 'Category', 'Published'], [])),
    Scenes: data._internal.gvizTable(gv(['Scene_ID', 'Scene_Name', 'Published'], [])),
    Features: data._internal.gvizTable(gv(['Feature_ID', 'Feature_Name', 'Published'], [])),
    Store_Menus: data._internal.gvizTable(gv(['Store_ID', 'Menu_ID'], [])),
    Store_Scenes: data._internal.gvizTable(gv(['Store_ID', 'Scene_ID'], [])),
    Store_Features: data._internal.gvizTable(gv(['Store_ID', 'Feature_ID'], [])),
  };
  const db = data._internal.buildDB(tables);
  assert.equal(db.stores.length, 1, '全セルnull行は例外を投げずにスキップされ、後続行は正常に取り込まれる');
  assert.equal(db.stores[0].id, 'S1');
});
t('data.buildDB: 追加シートが部分一致ヘッダーの場合は「未作成」警告を誤って出さない（列名ゆれの実データを許容）', () => {
  const storesHeaders = ['Store_ID', 'Store_Name', 'Area', 'Published'];
  const tables = {
    Stores: data._internal.gvizTable(gv(storesHeaders, [['S1', '店A', '新宿', 'TRUE']])),
    Menus: data._internal.gvizTable(gv(['Menu_ID', 'Menu_Name', 'Category', 'Published'], [])),
    Scenes: data._internal.gvizTable(gv(['Scene_ID', 'Scene_Name', 'Published'], [])),
    Features: data._internal.gvizTable(gv(['Feature_ID', 'Feature_Name', 'Published'], [])),
    Store_Menus: data._internal.gvizTable(gv(['Store_ID', 'Menu_ID'], [])),
    Store_Scenes: data._internal.gvizTable(gv(['Store_ID', 'Scene_ID'], [])),
    Store_Features: data._internal.gvizTable(gv(['Store_ID', 'Feature_ID'], [])),
    // Key列のみ一致・Text列は未解決(列名ゆれ) → 全滅ではないので「未作成」扱いにしない
    Site_Texts: data._internal.gvizTable(gv(['Key', 'Memo'], [['hero_catch', 'メモ']])),
    Pages: data._internal.gvizTable(gv(['Page_ID', 'Memo'], [['P1', 'メモ']])),
    Ads: data._internal.gvizTable(gv(['Ad_ID', 'Memo'], [['A1', 'メモ']])),
  };
  const db = data._internal.buildDB(tables);
  assert.ok(!db.warnings.some(w => w.indexOf('Site_Textsシートに列') >= 0), 'Site_Texts部分一致は列未解決warningを出さない');
  assert.ok(!db.warnings.some(w => w.indexOf('Pagesシートに列') >= 0), 'Pages部分一致は列未解決warningを出さない');
  assert.ok(!db.warnings.some(w => w.indexOf('Adsシートに列') >= 0), 'Ads部分一致は列未解決warningを出さない');
});
t('data.buildDB: Storesの非必須URL/画像列が未解決なら列名を明示したwarningsを積む（実装設計書13-I-4）', () => {
  const storesHeaders = ['Store_ID', 'Store_Name', 'Area', 'Published']; // 非必須7列(map/web/insta/video/ext/food/tiktok)を欠く
  const tables = {
    Stores: data._internal.gvizTable(gv(storesHeaders, [['S1', '店A', '新宿', 'TRUE']])),
    Menus: data._internal.gvizTable(gv(['Menu_ID', 'Menu_Name', 'Category', 'Published'], [])),
    Scenes: data._internal.gvizTable(gv(['Scene_ID', 'Scene_Name', 'Published'], [])),
    Features: data._internal.gvizTable(gv(['Feature_ID', 'Feature_Name', 'Published'], [])),
    Store_Menus: data._internal.gvizTable(gv(['Store_ID', 'Menu_ID'], [])),
    Store_Scenes: data._internal.gvizTable(gv(['Store_ID', 'Scene_ID'], [])),
    Store_Features: data._internal.gvizTable(gv(['Store_ID', 'Feature_ID'], [])),
  };
  const db = data._internal.buildDB(tables);
  assert.ok(db.warnings.some(w => w.indexOf('Storesシートの列『Official_Website』が見つかりません') >= 0));
  assert.ok(db.warnings.some(w => w.indexOf('Storesシートの列『Exterior_Image』が見つかりません') >= 0));
  assert.ok(db.warnings.some(w => w.indexOf('Storesシートの列『TikTok_URL』が見つかりません') >= 0));
});
t('data.buildDB: Stores必須列欠損warningは日本語ラベル（要件2-3の例示準拠）', () => {
  const tables = {
    Stores: data._internal.gvizTable(gv(['Store_Name'], [['店のみ']])), // Store_ID/Area/Published欠損
    Menus: data._internal.gvizTable(gv(['Menu_ID', 'Menu_Name', 'Category', 'Published'], [])),
    Scenes: data._internal.gvizTable(gv(['Scene_ID', 'Scene_Name', 'Published'], [])),
    Features: data._internal.gvizTable(gv(['Feature_ID', 'Feature_Name', 'Published'], [])),
    Store_Menus: data._internal.gvizTable(gv(['Store_ID', 'Menu_ID'], [])),
    Store_Scenes: data._internal.gvizTable(gv(['Store_ID', 'Scene_ID'], [])),
    Store_Features: data._internal.gvizTable(gv(['Store_ID', 'Feature_ID'], [])),
  };
  const db = data._internal.buildDB(tables);
  assert.ok(db.warnings.indexOf('Storesシートに必須列が見つかりません: Store_ID') >= 0);
  assert.ok(db.warnings.indexOf('Storesシートに必須列が見つかりません: エリア') >= 0);
  assert.ok(db.warnings.indexOf('Storesシートに必須列が見つかりません: 公開フラグ') >= 0);
});

// ===== 実行サマリ =====
console.log(results.join('\n'));
console.log('\n==== ' + pass + ' PASS / ' + fail + ' FAIL (' + (pass + fail) + ' total) ====');
process.exit(fail ? 1 : 0);
