/**
 * Собирает PDF лид-магнита из src/domain/guide.ts (тот же источник, что и читалка в приложении).
 *
 *   CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run guide:pdf
 *
 * Результат: public/guide/atlas-anxiety-guide.pdf
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GUIDE } from '../src/domain/guide';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', GUIDE.pdfPath);
const img = (name: string) => pathToFileURL(join(root, 'public/img', `${name}.webp`)).href;
const font = (file: string) => pathToFileURL(join(root, 'node_modules', file)).href;

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Chromium-Gost.app/Contents/MacOS/Chromium-Gost',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean) as string[];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<style>
@font-face { font-family: 'Cormorant'; font-weight: 500; src: url('${font('@fontsource/cormorant-garamond/files/cormorant-garamond-cyrillic-500-normal.woff2')}') format('woff2'); unicode-range: U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116; }
@font-face { font-family: 'Cormorant'; font-weight: 500; src: url('${font('@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff2')}') format('woff2'); }
@font-face { font-family: 'Cormorant'; font-style: italic; font-weight: 500; src: url('${font('@fontsource/cormorant-garamond/files/cormorant-garamond-cyrillic-500-italic.woff2')}') format('woff2'); unicode-range: U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116; }
@font-face { font-family: 'Cormorant'; font-style: italic; font-weight: 500; src: url('${font('@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-italic.woff2')}') format('woff2'); }
@font-face { font-family: 'Manrope'; font-weight: 200 800; src: url('${font('@fontsource-variable/manrope/files/manrope-cyrillic-wght-normal.woff2')}') format('woff2'); unicode-range: U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116; }
@font-face { font-family: 'Manrope'; font-weight: 200 800; src: url('${font('@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2')}') format('woff2'); }

@page { size: A4; margin: 0; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; }
body { font-family: 'Manrope', sans-serif; color: #1f1b16; background: #f6f2ec; font-size: 11.5pt; line-height: 1.55; }
.page { width: 210mm; height: 297mm; position: relative; overflow: hidden; page-break-after: always; padding: 22mm 20mm; }
.page:last-child { page-break-after: auto; }
.display { font-family: 'Cormorant', serif; font-weight: 500; letter-spacing: -0.01em; line-height: 1.02; }
.eyebrow { font-size: 8pt; font-weight: 800; letter-spacing: .22em; text-transform: uppercase; color: #a87a45; }
.cover { padding: 0; color: #fff; background: #0e0d0c; }
.cover img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.cover .shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.35) 0%, rgba(0,0,0,0) 35%, rgba(10,9,8,.92) 100%); }
.cover .top { position: absolute; top: 20mm; left: 20mm; right: 20mm; display: flex; justify-content: space-between; font-size: 9pt; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; }
.cover .text { position: absolute; left: 20mm; right: 20mm; bottom: 26mm; }
.cover h1 { font-size: 58pt; margin: 6mm 0 0; }
.cover h1 em { color: #f0d3a8; }
.cover p { font-size: 12pt; color: rgba(255,255,255,.8); max-width: 120mm; margin-top: 6mm; }
.cover .eyebrow { color: #f0d3a8; }
h2.display { font-size: 34pt; margin: 4mm 0 6mm; }
.lead { font-family: 'Cormorant', serif; font-size: 17pt; line-height: 1.3; }
.intro p { margin: 0 0 4mm; }
.toc { margin-top: 10mm; border-top: 1px solid #e3d9cc; }
.toc div { display: flex; gap: 6mm; padding: 3.2mm 0; border-bottom: 1px solid #e3d9cc; align-items: baseline; }
.toc b { font-family: 'Cormorant', serif; font-size: 17pt; color: #a87a45; width: 10mm; font-weight: 500; }
.toc span { flex: 1; font-weight: 700; }
.toc i { font-style: normal; font-size: 9pt; color: #8a8076; }
.tech-img { height: 62mm; margin: -22mm -20mm 10mm; position: relative; overflow: hidden; }
.tech-img img { width: 100%; height: 100%; object-fit: cover; }
.tech-img .num { position: absolute; right: 16mm; bottom: -6mm; font-family: 'Manrope'; font-weight: 800; font-size: 96pt; letter-spacing: -.05em; color: rgba(255,255,255,.75); line-height: .8; }
.chips { display: flex; gap: 2mm; }
.chip { font-size: 8.5pt; font-weight: 700; padding: 1.2mm 3mm; border-radius: 99px; background: #efe4d6; color: #8c5c27; }
.label { font-size: 7.5pt; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; color: #a87a45; margin: 5mm 0 1mm; }
ol { list-style: none; padding: 0; margin: 5mm 0 0; counter-reset: s; }
ol li { counter-increment: s; display: flex; gap: 4mm; margin-bottom: 2.6mm; }
ol li::before { content: counter(s); flex-shrink: 0; width: 6.5mm; height: 6.5mm; border-radius: 50%; background: #1f1b16; color: #f6f2ec; font-size: 8.5pt; font-weight: 800; display: grid; place-items: center; margin-top: .4mm; }
.tip { margin-top: 5mm; padding: 4mm 5mm; border-radius: 4mm; background: #efe4d6; font-size: 10.5pt; }
.tip b { color: #8c5c27; }
.help { border: 1px solid #d8cbbb; border-radius: 5mm; padding: 7mm; margin-top: 8mm; }
.help ul { margin: 3mm 0 0; padding-left: 5mm; }
.crisis { margin-top: 5mm; padding-top: 4mm; border-top: 1px solid #e3d9cc; font-size: 10pt; color: #5d554c; }
.outro { background: #0e0d0c; color: #f4ede4; }
.outro .display { font-size: 26pt; line-height: 1.2; color: #f4ede4; }
.outro .sign { position: absolute; left: 20mm; right: 20mm; bottom: 22mm; display: flex; justify-content: space-between; font-size: 9pt; color: rgba(244,237,228,.55); }
.footer { position: absolute; left: 20mm; right: 20mm; bottom: 12mm; display: flex; justify-content: space-between; font-size: 8pt; color: #9c9188; }
.mark { display: inline-block; vertical-align: middle; }
</style></head><body>

<section class="page cover">
  <img src="${img('hero-clouds')}">
  <div class="shade"></div>
  <div class="top"><span>Атлас</span><span>Школа психологии</span></div>
  <div class="text">
    <div class="eyebrow">${esc(GUIDE.subtitle)}</div>
    <h1 class="display">7 техник <em>самопомощи</em><br>при тревоге</h1>
    <p>Короткие, проверенные упражнения из КПТ, ACT и практик осознанности — чтобы возвращаться в равновесие за 1–15 минут.</p>
  </div>
</section>

<section class="page intro">
  <div class="eyebrow">Вступление</div>
  <h2 class="display">Как пользоваться гайдом</h2>
  ${GUIDE.intro.map((p, i) => `<p class="${i === 0 ? 'lead' : ''}">${esc(p)}</p>`).join('')}
  <div class="toc">
    ${GUIDE.techniques.map((t) => `<div><b>${String(t.n).padStart(2, '0')}</b><span>${esc(t.title)}</span><i>${esc(t.minutes)}</i></div>`).join('')}
  </div>
  <div class="footer"><span>Атлас · школа практической психологии</span><span>2</span></div>
</section>

${GUIDE.techniques
  .map(
    (t, idx) => `
<section class="page">
  <div class="tech-img"><img src="${img(t.image)}"><div class="num">${String(t.n).padStart(2, '0')}</div></div>
  <div class="chips"><span class="chip">${esc(t.approach)}</span><span class="chip">${esc(t.minutes)}</span></div>
  <h2 class="display">${esc(t.title)}</h2>
  <div class="label">Когда использовать</div><div>${esc(t.when)}</div>
  <div class="label">Почему это работает</div><div>${esc(t.why)}</div>
  <div class="label">Как выполнять</div>
  <ol>${t.steps.map((s) => `<li><span>${esc(s)}</span></li>`).join('')}</ol>
  ${t.tip ? `<div class="tip"><b>Совет.</b> ${esc(t.tip)}</div>` : ''}
  <div class="footer"><span>${esc(GUIDE.title)}</span><span>${idx + 3}</span></div>
</section>`,
  )
  .join('')}

<section class="page">
  <div class="eyebrow">Важно</div>
  <h2 class="display">Когда стоит обратиться к специалисту</h2>
  <p>Техники самопомощи эффективны при повседневной тревоге, но не заменяют работу с психологом или врачом. Обратитесь за помощью, если:</p>
  <div class="help">
    <ul>${GUIDE.whenToSeekHelp.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
    <div class="crisis">${esc(GUIDE.crisisNote)}</div>
  </div>
  <div class="footer"><span>${esc(GUIDE.title)}</span><span>${GUIDE.techniques.length + 3}</span></div>
</section>

<section class="page outro">
  <div class="eyebrow">Что дальше</div>
  <p class="display" style="margin-top:8mm">${esc(GUIDE.outro)}</p>
  <p style="margin-top:10mm;color:rgba(244,237,228,.7)">Откройте приложение «Атлас» в Telegram: практики, задания и персональные скидки на программы школы.</p>
  <div class="sign"><span>${esc(GUIDE.author)}</span><span>Материал не является медицинской рекомендацией</span></div>
</section>
</body></html>`;

const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chrome) {
  console.error('Не найден Chrome/Chromium. Укажите путь: CHROME_PATH=... npm run guide:pdf');
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), 'atlas-guide-'));
const htmlPath = join(dir, 'guide.html');
writeFileSync(htmlPath, html);
mkdirSync(dirname(out), { recursive: true });
execFileSync(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-pdf-header-footer',
    '--allow-file-access-from-files',
    '--virtual-time-budget=4000',
    `--print-to-pdf=${out}`,
    pathToFileURL(htmlPath).href,
  ],
  { stdio: 'inherit' },
);
console.log(`PDF готов: ${out}`);
