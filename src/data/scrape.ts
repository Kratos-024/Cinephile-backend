import puppeteer from "puppeteer";

export class ScrapeTrending {
  browser: any;
  page: any;
  browserOptions: any;

  constructor() {
    const browserOptions = { headless: false };
    this.browserOptions = browserOptions;
  }
  async start() {
    const browser = await puppeteer.launch(this.browserOptions);
    const page = await browser.newPage();
    this.browser = browser;
    this.page = page;
    await page.goto("imdb.com/list/ls082250769/");
    console.log("loaded");
  }
}
