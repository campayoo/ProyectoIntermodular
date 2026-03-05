const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();

        page.on('console', msg => console.log('LOG:', msg.text()));
        page.on('pageerror', err => console.log('ERROR:', err.toString()));

        await page.goto('http://localhost:8080/juegos/juego3/index.html', { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 2000));

        await browser.close();
    } catch (err) {
        console.error('Puppeteer error:', err);
    }
})();
