// Use an installed Playwright runtime: PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.js node tests/browser-smoke.mjs
import assert from 'node:assert/strict';
const runtime = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { chromium } = runtime.default || runtime;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:3000');
  await page.getByText('โหมดทดลอง', { exact: true }).waitFor();
  await page.screenshot({ path: '.impeccable/review/desktop.png', fullPage: true });
  const search=page.getByRole('textbox',{name:'ค้นหาชื่อหรือรหัสผู้ใช้'});
  await search.fill('ไม่พบแน่นอน');
  await page.getByText('ไม่พบผู้สนทนา',{exact:true}).waitFor();
  await page.getByRole('button',{name:'ล้างคำค้น'}).click();
  await page.getByRole('button',{name:/นนท์ ธนกร/}).click();
  const editor=page.getByRole('textbox',{name:/ข้อความถึง/});
  await editor.fill('draft for Nont');
  await page.getByRole('button',{name:/พลอย พิมพ์ชนก/}).click();
  assert.equal(await editor.inputValue(),'');
  await editor.fill('ข้อความทดสอบ <script>alert(1)</script>');
  await editor.press('Enter');
  await page.getByRole('log').getByText('ข้อความทดสอบ <script>alert(1)</script>',{exact:true}).waitFor();
  assert.equal(await editor.inputValue(),'');
  await page.getByRole('button',{name:/นนท์ ธนกร/}).click();
  assert.equal(await editor.inputValue(),'draft for Nont');
  assert.equal(await page.getByRole('log').getByText('ข้อความทดสอบ <script>alert(1)</script>',{exact:true}).count(),0);
  await page.getByRole('button',{name:'จำลองข้อความเข้า'}).click();
  await page.getByRole('log').getByText('ขอบคุณค่ะ ขอรายละเอียดเพิ่มเติมได้ไหมคะ',{exact:true}).waitFor();
  await page.reload();
  await page.getByText('โหมดทดลอง',{exact:true}).waitFor();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'.impeccable/review/mobile.png',fullPage:true});
  await page.getByRole('button',{name:/พลอย พิมพ์ชนก/}).click();
  await page.getByRole('textbox',{name:/ข้อความถึง/}).waitFor();
  await page.screenshot({path:'.impeccable/review/mobile-chat.png',fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await page.locator('.topbar').evaluate(el=>el.getBoundingClientRect().top>=0));
  await page.getByRole('button',{name:'กลับไปรายชื่อ'}).click();
  await search.waitFor({state:'visible'});
  for(const width of [320,768]) {
    await page.setViewportSize({width,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: search, draft isolation, sending, safe text rendering, incoming demo, reset, mobile navigation, 320/390/768 overflow, no page errors.');
} finally { await browser.close(); }
