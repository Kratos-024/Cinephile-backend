import puppeteer, { Page } from "puppeteer";

export class ScrapeTrending {
  browser: any;
  page: Page | undefined;
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
    await page.goto("https://www.imdb.com/list/ls082250769/", {
      waitUntil: "networkidle2",
    });
    await this.scrape();
  }
  async scrape() {
    console.log("hello");
    const data = await this.page?.$$eval(
      ".ipc-metadata-lipc-metadata-list-summary-itemist",
      (response) => {
        return response.map((option) => option.textContent);
      }
    );
    console.log("hello3", data);
  }
}
