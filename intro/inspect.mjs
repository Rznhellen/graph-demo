// DevTools-driven inspection: load the page, scrub through scroll positions,
// capture console errors + screenshots at each story beat.
import puppeteer from 'puppeteer';

const beats = process.argv[2]
  ? process.argv[2].split(',').map(Number)
  : [0, 60, 180, 250, 360, 430, 520, 640, 700, 800, 870, 970];

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--window-size=1440,900'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 1500));

// beats are in pre-scale story vh; SCROLL_SCALE in src/scroll.js stretches the page
const SCROLL_SCALE = 1.8;
for (const vh of beats) {
  await page.evaluate((v) => scrollTo(0, (innerHeight * v) / 100), vh * SCROLL_SCALE);
  await new Promise((r) => setTimeout(r, 1200)); // let scrub catch up
  await page.screenshot({ path: `/tmp/shots/beat-${String(vh).padStart(4, '0')}.png` });
  console.log(`captured beat ${vh}vh`);
}

console.log('\n--- console output ---');
console.log(errors.length ? errors.join('\n') : '(no errors or warnings)');
await browser.close();
