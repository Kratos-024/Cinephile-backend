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
    console.log("gelo");
    return await this.scrape();
  }
  async scrape() {
    const movieList = await this.page?.$$eval(
      ".ipc-metadata-list-summary-item",
      (elements) => {
        return elements.map((element) => {
          return {
            // Title and ranking
            title:
              element.querySelector(".ipc-title__text")?.textContent?.trim() ||
              "",

            // Movie metadata
            year:
              element
                .querySelector(".dli-title-metadata-item:first-child")
                ?.textContent?.trim() || "",
            runtime:
              element
                .querySelector(".dli-title-metadata-item:nth-child(2)")
                ?.textContent?.trim() || "",
            rating:
              element
                .querySelector(".dli-title-metadata-item:nth-child(3)")
                ?.textContent?.trim() || "",

            // Scores
            imdbRating:
              element
                .querySelector(".ipc-rating-star--rating")
                ?.textContent?.trim() || "",
            imdbVotes:
              element
                .querySelector(".ipc-rating-star--voteCount")
                ?.textContent?.trim()
                .replace(/[()]/g, "") || "",
            metascore:
              element
                .querySelector(".metacritic-score-box")
                ?.textContent?.trim() || "",

            // Plot description
            plot:
              element
                .querySelector(
                  ".title-description-plot-container .ipc-html-content-inner-div"
                )
                ?.textContent?.trim() || "",

            // Director
            director:
              element
                .querySelector(".title-description-credit a")
                ?.textContent?.trim() || "",

            // Stars (actors) - get all except first one (which is director)
            stars: Array.from(
              element.querySelectorAll(".title-description-credit a")
            )
              .slice(1)
              //@ts-ignore
              .map((star) => star.textContent?.trim())
              .filter(Boolean),

            // Poster image
            posterUrl:
              element.querySelector(".ipc-image")?.getAttribute("src") || "",
            posterAlt:
              element.querySelector(".ipc-image")?.getAttribute("alt") || "",

            // Movie URL
            movieUrl:
              element
                .querySelector(".ipc-title-link-wrapper")
                ?.getAttribute("href") || "",

            // Watchlist ID
            watchlistId:
              element
                .querySelector('[data-testid^="inline-watched-button-"]')
                ?.getAttribute("data-testid")
                ?.replace("inline-watched-button-", "") || "",

            // List position/ranking number
            ranking:
              element
                .querySelector(".ipc-title__text")
                ?.textContent?.match(/^\d+/)?.[0] || "",
          };
        });
      }
    );

    if (!Array.isArray(movieList)) {
      return [];
    }
    return movieList;
  }
}
