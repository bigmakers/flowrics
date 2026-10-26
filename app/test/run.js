/* Flowrics Web のブラウザテスト。YouTube / LRCLIB / oEmbed / Piped をスタブに差し替え、ヘッドレス Chromium で動かす。
   使い方: npm i playwright (どこかの作業ディレクトリで) → node app/test/run.js  (環境変数 PW_CHROME で Chromium のパス指定可)
   LRCLIB の実データ(米津玄師「Lemon」の検索結果)を app/test/lrc.json に置く:
   curl -o app/test/lrc.json "https://lrclib.net/api/search?track_name=Lemon&artist_name=%E7%B1%B3%E6%B4%A5%E7%8E%84%E5%B8%AB" */
const path = require('path'), fs = require('fs'), http = require('http');
const resolveFrom = (name) => { for (const d of [process.cwd(), process.env.PW_MODULES || '', path.join(process.env.HOME || '', 'node_modules')]) { try { return require(require.resolve(name, { paths: [d] })); } catch (e) {} } return require(name); };
const { chromium } = resolveFrom('playwright');
const root = path.resolve(__dirname, '..', '..');
const chromePath = process.env.PW_CHROME || (() => { const base = '/opt/pw-browsers'; try { for (const d of fs.readdirSync(base).filter(x => x.startsWith('chromium-')).sort().reverse()) { for (const c of ['chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-headless-shell-linux64/chrome-headless-shell']) { const p = path.join(base, d, c); if (fs.existsSync(p)) return p; } } } catch (e) {} return undefined; })();
const lrc = fs.readFileSync(path.join(__dirname, 'lrc.json'), 'utf8');
const stub = fs.readFileSync(path.join(__dirname, 'ytstub.js'), 'utf8');
const srv = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'application/javascript' : 'text/html; charset=utf-8' }); res.end(d); });
}).listen(0);
let fails = 0; const assert = (c, m) => { if (!c) { fails++; console.log('ASSERT FAIL:', m); } else console.log('ok:', m); };
async function setupPage(ctx, errors) {
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  await page.route('https://www.youtube.com/iframe_api', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: stub }));
  await page.route(/lrclib\.net\/api\/search/, r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: lrc }));
  await page.route(/youtube\.com\/oembed/, r => { const id = new URL(r.request().url()).searchParams.get('url').split('v=')[1]; r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ title: 'Title of ' + id, author_name: id + ' Channel - Topic' }) }); });
  await page.route(/i\.ytimg\.com|fonts\.g/, r => r.abort());
  return page;
}
(async () => {
  const base = 'http://localhost:' + srv.address().port + '/app/';
  const browser = await chromium.launch(chromePath ? { executablePath: chromePath } : {});
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  // 以前からの利用者を模倣: 弾幕モードを保存済み(文字PV 既定の確認は最後に別コンテキストで行う)
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('flowrics.settings')) localStorage.setItem('flowrics.settings', JSON.stringify({ sizeOpt: 'random', mode: 'danmaku' })); } catch (e) {} });
  const page = await setupPage(ctx, errors);
  const synced = () => page.waitForFunction(() => /同期歌詞|Synced/.test(document.querySelector('#lyricPill').textContent), null, { timeout: 8000 });
  const ev = (fn, arg) => page.evaluate(fn, arg);

  // ---------- 起動・歌詞 ----------
  await page.goto(base + '?v=SX_ViT4Ra7k,dQw4w9WgXcQ', { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#player').tagName === 'IFRAME', null, { timeout: 5000 });
  await synced();
  let info = await ev(() => ({ track: trackInput.value, artist: artistInput.value, results: document.querySelectorAll('#resultList li').length, lines: lines.length, state: __stub.state, q: document.querySelectorAll('#queueList li').length, pl: __stub.pl && __stub.pl.length, cur }));
  assert(info.track === 'Lemon' && info.artist === '米津玄師', 'guessMeta parses Artist「Track」');
  assert(info.lines > 20 && info.results > 0, 'LRC parsed, candidates rendered');
  assert(info.state === 5 && info.pl === 2 && info.cur === 0, 'queue cued as a player playlist, not autoplaying');
  assert(await ev(() => !lines.some(l => /^作词|^作曲|^编曲/.test(l.text))), 'credit lines skipped');
  assert(await ev(() => candidates[0].diff <= 5), 'closest duration candidate first');

  // ---------- 弾幕 ----------
  await page.click('#play'); await page.waitForTimeout(300); await ev(() => __stub.seekTo(60)); await page.waitForTimeout(7000);
  const dm = await ev(() => { const dms = [...document.querySelectorAll('.dm')]; const main = dms.filter(d => d.style.opacity === '1'); return { n: dms.length, ops: new Set(dms.map(d => d.style.opacity)).size, cls: [...new Set([...document.querySelectorAll('.dm span')].map(x => x.className))], mainPop: main.length > 0 && main.every(d => d.classList.contains('pop')), delays: main[0] ? [...main[0].querySelectorAll('span')].map(x => x.style.animationDelay) : [], dur: dms[0] && dms[0].style.animationDuration, now: nowline.textContent, play: document.querySelector('#play').textContent }; });
  assert(dm.n > 0 && dm.ops >= 2, 'danmaku spawned on several layers');
  assert(dm.cls.includes('k') && dm.cls.includes('h'), 'kanji / hiragana typography spans');
  assert(dm.mainPop && dm.delays[1] === '45ms', 'main layer bounces with staggered delay');
  assert(dm.dur === '8s' && dm.now.length > 0 && dm.play === '❚❚', '8s crossing, current line, play state');
  const tok = await ev(() => ({ jp: tokenize('夢ならばどれほどよかったでしょう').map(t => t.type).join(), en: tokenize('I love you baby').map(t => t.type).join(), kata: tokenize('ラブソング 歌う').map(t => t.type).join() }));
  assert(tok.jp === 'kanji,hira' && tok.en === 'latin-minor,latin-major,latin-minor,latin-major' && tok.kata === 'kata,kanji,hira', 'tokenizer');
  await page.keyboard.press('Space'); await page.waitForTimeout(200);
  assert(await ev(() => danmaku.classList.contains('paused') && __stub.state === 2), 'space pauses');
  await page.keyboard.press('Space'); await page.waitForTimeout(200);
  await ev(() => __stub.seekTo(10)); await page.waitForTimeout(300);
  assert(await ev(() => document.querySelectorAll('.dm').length === 0 && fired.size === 0), 'backward seek clears');

  // ---------- サビ ----------
  const ch = await ev(() => ({ n: chorus.length, first: chorus[0], marked: document.querySelector('#seek').classList.contains('marked') }));
  assert(ch.n >= 2 && Math.abs(ch.first.start - 58.6) < 1 && ch.marked, 'chorus detected and marked on the seek bar');
  await ev(() => { settings.sizeOpt = 'medium'; applySettings(); clearDanmaku(); __stub.seekTo(62); }); await page.waitForTimeout(2500);
  const inCh = await ev(() => { const d = [...document.querySelectorAll('.dm')].find(x => x.style.opacity === '1'); return d && { chorus: d.classList.contains('chorus'), strong: d.classList.contains('strong'), k: d.querySelector('.k') && parseFloat(d.querySelector('.k').style.fontSize) }; });
  assert(inCh && inCh.chorus && inCh.strong && (inCh.k === null || Math.abs(inCh.k - 60) < 0.5), 'chorus: strong motion and 1.5x size');
  await ev(() => { settings.sizeOpt = 'random'; applySettings(); });

  // ---------- 内蔵プレイリストでの進行・リピート ----------
  await page.click('#next'); await page.waitForTimeout(800);
  info = await ev(() => ({ cur, vid: __stub.vid, track: trackInput.value, artist: artistInput.value, sub: hudSub.textContent }));
  assert(info.vid === 'dQw4w9WgXcQ' && info.cur === 1 && info.track === 'Some Song' && info.artist === 'Other Artist' && info.sub === 'Other', 'next plays via playVideoAt and parses Artist - Track');
  await ev(() => __stub.set(0)); await page.waitForTimeout(600);
  assert(await ev(() => cur === 0 && __stub.vid === 'SX_ViT4Ra7k' && __stub.state === 1), 'repeat all: player loops itself and the queue follows');
  await page.click('#repeat'); await page.click('#repeat');   // all -> one -> off
  await ev(() => playIndex(1)); await page.waitForTimeout(400); await ev(() => __stub.set(0)); await page.waitForTimeout(400);
  assert(await ev(() => cur === 1 && __stub.state === 0 && __stub.loop === false), 'repeat off: stops at the end');
  await page.click('#repeat');   // off -> all
  await ev(() => { __stub.set(1); __stub.seekTo(5); });
  // 再生中にキューが増える → 曲の終わりで渡し直して次へ
  await ev(() => { queue.push({ id: 'zzzzzzzzzzz' }); saveQueue(); renderQueue(); });
  await ev(() => __stub.set(0)); await page.waitForTimeout(600);
  assert(await ev(() => cur === 2 && __stub.vid === 'zzzzzzzzzzz' && __stub.pl.length === 3), 'queue edited during playback: reloaded at the song end and advanced');
  await ev(() => __stub.set(0)); await page.waitForTimeout(600);
  assert(await ev(() => cur === 0 && __stub.vid === 'SX_ViT4Ra7k'), 'wraps to the first item with repeat all');
  await ev(() => { removeAt(2); });
  assert(await ev(() => queue.length === 2 && cur === 0), 'removing a later item keeps current');

  // ---------- 手動 LRC・オフセット・URL ----------
  await page.click('#panelBtn'); await page.click('.tabs button[data-tab=lyrics]');
  await page.fill('#lrcText', '[00:01.00] hello\n[00:02.50] world\n[ar: someone]'); await page.click('#applyLrc'); await page.waitForTimeout(200);
  assert(await ev(() => lines.length === 2 && lines[1].t === 2.5 && /手動|Manual/.test(lyricPill.textContent)), 'manual LRC applied');
  await ev(() => setOffset(0.7));
  assert(await ev(() => offsetVal.textContent === '+0.7s' && localStorage.getItem('flowrics.offset.SX_ViT4Ra7k') === '0.7'), 'offset persisted per video');
  await page.click('.tabs button[data-tab=queue]');
  await page.fill('#urlInput', 'not a url'); await page.click('#addBtn'); await page.waitForTimeout(100);
  assert(await ev(() => queue.length === 2), 'invalid url rejected');
  await page.fill('#urlInput', 'https://youtube.com/shorts/abcdefghijk?feature=share'); await page.press('#urlInput', 'Enter'); await page.waitForTimeout(600);
  assert(await ev(() => queue.length === 3 && queue[2].id === 'abcdefghijk' && queue[2].title === 'Title of abcdefghijk' && queue[2].author === 'abcdefghijk'), 'shorts url added, title via oEmbed');
  await ev(() => { queue.push({ id: 'BADBADBAD11' }); saveQueue(); renderQueue(); playIndex(3); }); await page.waitForTimeout(2600);
  assert(await ev(() => cur === 0 && __stub.vid === 'SX_ViT4Ra7k'), 'embed error skips to the next (wrapped)');
  await ev(() => removeAt(3));

  // ---------- プレイリスト取り込み・保存 ----------
  await ev(() => __stub.pauseVideo());
  const before = await ev(() => queue.length);
  await page.fill('#urlInput', 'https://www.youtube.com/playlist?list=PLgoodlist12345'); await page.click('#addBtn'); await page.waitForTimeout(1500);
  assert(await ev((b) => queue.length === b + 3 && queue[b].id === 'p1p1p1p1p1p' && cur === b && __stub.vid === 'p1p1p1p1p1p' && !importing && urlInput.value === '', before), 'playlist URL imports all ids and plays the first');
  await ev(() => { __stub.set(1); __stub.seekTo(42); });
  await page.fill('#urlInput', 'https://www.youtube.com/watch?v=SX_ViT4Ra7k&list=PLanotherlist0123456789'); await page.click('#addBtn'); await page.waitForTimeout(1500);
  assert(await ev((b) => cur === b && __stub.vid === 'p1p1p1p1p1p' && Math.abs(__stub.lastStart - 42) < 1 && queue.length === b + 6, before), 'import during playback resumes the current track at its position');
  await page.fill('#urlInput', 'https://www.youtube.com/playlist?list=PLBADBADBADBADBAD'); await page.click('#addBtn'); await page.waitForTimeout(600);
  assert(await ev((b) => queue.length === b + 6 && !importing && /プレイリスト|playlist/.test(document.querySelector('#toast').textContent), before), 'failed import reports');
  await page.fill('#plName', 'ドライブ'); await page.press('#plName', 'Enter'); await page.waitForTimeout(100);
  assert(await ev(() => playlists.length === 1 && playlists[0].items.length === queue.length && document.querySelectorAll('#plList li').length === 1), 'queue saved as a named playlist');
  await ev(() => { queue = [{ id: 'SX_ViT4Ra7k' }]; cur = -1; saveQueue(); renderQueue(); });
  await page.click('#plList li'); await page.waitForTimeout(500);
  assert(await ev(() => queue.length === playlists[0].items.length && cur === 0 && __stub.vid === queue[0].id), 'loading a saved playlist replaces the queue and plays');
  await page.click('#plList li .x'); await page.waitForTimeout(50);
  assert(await ev(() => playlists.length === 0), 'deleting a saved playlist');
  const plStyle = await ev(() => { const cs = getComputedStyle(document.querySelector('#plName')); return cs.backgroundColor !== 'rgb(255, 255, 255)' && cs.color === 'rgb(255, 255, 255)'; });
  assert(plStyle, 'panel inputs are dark with white text');

  // ---------- YouTube 検索 (Piped: 1台目が落ちて2台目が答える) ----------
  let pipedCalls = [];
  await page.route(/api\.piped\.private\.coffee\/search/, r => { pipedCalls.push('coffee'); r.abort(); });
  await page.route(/pipedapi\.ducks\.party\/search/, r => { pipedCalls.push('ducks'); r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ items: [
    { url: '/watch?v=hhhhhhhhhhh', title: '宇多田ヒカル - First Love', uploaderName: 'Hikaru Utada', duration: 275, type: 'stream' }, { url: '/channel/x', title: 'ch', type: 'channel' }, { url: '/watch?v=lmnopqrstuv', title: 'Second', uploaderName: 'Ch', duration: 100, type: 'stream' } ] }) }); });
  await page.fill('#ytq', '宇多田'); await page.press('#ytq', 'Enter'); await page.waitForTimeout(800);
  const sr = await ev(() => ({ n: document.querySelectorAll('#ytResults li').length, first: document.querySelector('#ytResults li b').textContent, good: localStorage.getItem('flowrics.pipedGood') }));
  assert(sr.n === 2 && sr.first === '宇多田ヒカル - First Love' && sr.good === '"https://pipedapi.ducks.party"', 'search falls back to the next instance, videos only');
  const qb = await ev(() => queue.length); await ev(() => __stub.pauseVideo());
  await page.click('#ytResults li'); await page.waitForTimeout(500);
  assert(await ev((b) => queue.length === b + 1 && cur === b && __stub.vid === 'hhhhhhhhhhh', qb), 'clicking a result queues and plays it');
  const cb = pipedCalls.length; await page.fill('#ytq', '宇多田'); await page.click('#ytSearchBtn'); await page.waitForTimeout(300);
  assert(pipedCalls.length === cb, 'repeat search served from cache');
  await ev(() => { window.__opened = null; window.open = (u) => { window.__opened = u; return null; }; });
  await page.unroute(/pipedapi\.ducks\.party\/search/); await page.route(/pipedapi\.(ducks\.party|adminforge\.de|kavin\.rocks)\/search/, r => r.abort());
  await page.fill('#ytq', 'nothing here'); await page.click('#ytSearchBtn'); await page.waitForTimeout(1500);
  assert(await ev(() => (__opened || '').includes('results?search_query=nothing')), 'all instances down: opens YouTube in a new tab');

  // ---------- 設定・言語・保存 ----------
  await page.click('.tabs button[data-tab=settings]');
  await page.click('#sizeSeg button[data-v=xl]'); await page.click('#bgSwatches button[data-v=beige]');
  assert(await ev(() => settings.sizeOpt === 'xl' && getComputedStyle(document.documentElement).getPropertyValue('--stage-bg').trim() === 'rgb(245,237,222)' && document.querySelectorAll('#font option').length === 16), 'size, background swatch, font list');
  await page.click('#langBtn2'); await page.waitForTimeout(100);
  const lang = await ev(() => document.documentElement.lang);
  assert(lang === 'ja' || lang === 'en', 'language toggles');

  // ---------- 文字PV (JIZURA) ----------
  await page.click('#modeSeg button[data-v=pv]');
  await page.waitForFunction(() => window.pv && pv.ready && pv.plan, null, { timeout: 30000 });
  const pvInfo = await ev(() => ({ pvmode: document.body.classList.contains('pvmode'), styles: document.querySelectorAll('#pvStyle option').length, cuts: pv.plan.cuts.length, aspect: pv.aspect, dur: pv.plan.duration, song: pvSong, perSong: settings.pvPerSong, saved: !!localStorage.getItem('flowrics.pv.v.' + pvSong) }));
  assert(pvInfo.pvmode && pvInfo.styles >= 24 && pvInfo.cuts > 5 && pvInfo.aspect === '16:9' && Math.abs(pvInfo.dur - 256) < 1, 'PV mode: engine loaded, plan built from lyrics, duration follows the video');
  assert(pvInfo.perSong && pvInfo.song && pvInfo.saved, 'per-song style saved for the current video');
  await page.click('#closePanel'); await ev(() => { __stub.set(1); __stub.seekTo(8); }); await page.waitForTimeout(1200);
  const drawn = await ev(() => { const cv = document.querySelector('#pv'), ctx = cv.getContext('2d'); let best = 0; for (const t of [8, 9, 12, 20, 30]) { ctx.clearRect(0, 0, cv.width, cv.height); pv.renderer.frame(ctx, pv.plan, t, { scale: cv.width / pv.plan.W, transparent: true, noHud: true }); const d = ctx.getImageData(0, 0, cv.width, cv.height).data; let o = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) o++; best = Math.max(best, o / (d.length / 4)); } return { ratio: best, dm: document.querySelectorAll('.dm').length }; });
  console.log(drawn);
  assert(drawn.ratio > 0.003 && drawn.dm === 0, 'PV canvas draws over the video, danmaku suppressed');
  await page.click('#panelBtn'); const st0 = await ev(() => pvState.style);
  await page.click('#pvOmakase'); await page.waitForTimeout(300);
  assert(await ev((s0) => pvState.style !== s0 && pvState.mood && document.querySelector('#pvStyle').value === pvState.style && JSON.parse(localStorage.getItem('flowrics.pv.v.' + pvSong)).style === pvState.style, st0), 'omakase changes and persists per song');
  const seed0 = await ev(() => pvState.seed); await page.click('#pvReroll'); await page.waitForTimeout(200);
  assert(await ev((s) => pvState.seed !== s && pv.plan.seed === pvState.seed, seed0), 'reroll changes the seed and replans');
  const song1 = await ev(() => pvSong), idx1 = await ev(() => cur), state1 = await ev(() => ({ style: pvState.style, seed: pvState.seed }));
  await ev(() => playIndex(1));
  await page.waitForFunction((s1) => pvSong && pvSong !== s1 && pv.plan, song1, { timeout: 8000 });
  assert(await ev(() => pvState.mood && !!localStorage.getItem('flowrics.pv.v.' + pvSong)), 'next song gets its own auto style');
  await ev((i) => playIndex(i), idx1); await page.waitForFunction((s1) => pvSong === s1, song1, { timeout: 8000 });
  assert(await ev((s) => pvState.style === s.style && pvState.seed === s.seed, state1), 'returning to a song restores its style');
  await page.click('#pvBgSeg button[data-v=opaque]'); await page.waitForTimeout(400);
  assert(await ev(() => document.querySelector('#pv').getContext('2d').getImageData(2, 2, 1, 1).data[3] === 255), 'opaque background paints the canvas');
  await page.click('#pvBgSeg button[data-v=transparent]');
  await page.setViewportSize({ width: 400, height: 800 }); await page.waitForTimeout(400);
  assert(await ev(() => pv.aspect === '9:16' && pv.plan.W === 1080 && document.documentElement.scrollWidth <= 400), 'portrait viewport: 9:16 plan, no horizontal overflow');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.click('#modeSeg button[data-v=danmaku]'); await page.waitForTimeout(200);
  assert(await ev(() => !document.body.classList.contains('pvmode') && document.querySelector('#pvOpts').hidden), 'back to danmaku');

  // ---------- 再読み込みで復元 ----------
  await ev(() => { queue = [{ id: 'SX_ViT4Ra7k' }, { id: 'dQw4w9WgXcQ' }]; cur = -1; saveQueue(); });
  await page.goto(base, { waitUntil: 'load' }); await page.waitForTimeout(800);
  assert(await ev(() => queue.length === 2 && settings.sizeOpt === 'xl' && settings.bg === 'beige' && settings.mode === 'danmaku'), 'state restored from localStorage');

  // ---------- 初訪問: 文字PV が既定 ----------
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const p2 = await setupPage(ctx2, errors);
  await p2.goto(base + '?v=SX_ViT4Ra7k', { waitUntil: 'load' });
  await p2.waitForFunction(() => window.pv && pv.ready && pv.plan, null, { timeout: 30000 });
  assert(await p2.evaluate(() => settings.mode === 'pv' && document.body.classList.contains('pvmode') && document.querySelector('#modeSeg button').dataset.v === 'pv'), 'fresh visitor gets the JIZURA mode by default');
  await ctx2.close();

  console.log('ERRORS:', errors);
  assert(errors.length === 0, 'no JS errors');
  await browser.close(); srv.close();
  console.log(fails ? `FAILED (${fails})` : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('TEST CRASH', e); process.exit(1); });
