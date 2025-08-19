import puppeteer, { Browser, Page } from "puppeteer";

export default class Scraper {
  browser: Browser | null = null;
  page: Page | null = null;

  // Updated browser options to handle cross-platform compatibility
  browserOptions = {
    headless: true,
    // Remove executablePath to let Puppeteer handle it automatically
    // executablePath: undefined, // Let Puppeteer find Chrome/Chromium automatically
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
    ],
  };

  async start(link: string) {
    try {
      this.browser = await puppeteer.launch(this.browserOptions);
      this.page = await this.browser.newPage();

      // Set a user agent to avoid being blocked
      await this.page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await this.page.goto(link, { waitUntil: "networkidle2" });
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (error) {
      console.error("Failed to start browser:", error);
      throw error;
    }
  }

  async scrapeCompleteMovieData(link: string) {
    await this.start(link);
    if (!this.page) throw new Error("Page not initialized");

    try {
      const [
        basicInfo,
        storyline,
        ratings,
        cast,
        videos,
        images,
        videoSources,
        poster,
      ] = await Promise.all([
        this.scrapeBasicInfo().catch(() => null),
        this.scrapeStoryline().catch(() => null),
        this.scrapeRatings().catch(() => null),
        this.scrapeCast().catch(() => null),
        this.scrapeVideos().catch(() => null),
        this.scrapeImages().catch(() => null),
        this.scrapeVideoSources().catch(() => null),
        this.scrapePoster().catch(() => null),
      ]);

      const movieData = {
        url: link,
        scrapedAt: new Date().toISOString(),
        ...basicInfo,
        storyline,
        ratings,
        cast,
        videos,
        images,
        videoSources,
        poster,
      };
      console.log(movieData);
      await this.close();
      return movieData;
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  async scrapePoster() {
    if (!this.page) throw new Error("Page not loaded. Call start first.");

    try {
      await this.page.waitForSelector('[data-testid="hero-media__poster"]', {
        timeout: 5000,
      });

      const posterUrl = await this.page.evaluate(() => {
        const posterSelectors = [
          '[data-testid="hero-media__poster"] .ipc-image',
          ".ipc-poster__poster-image .ipc-image",
          ".sc-b234497d-7 .ipc-image",
          ".ipc-media--poster-27x40 .ipc-image",
          ".ipc-poster .ipc-image",
        ];

        let posterImg = null;
        for (const selector of posterSelectors) {
          //@ts-ignore
          posterImg = document.querySelector(selector) as HTMLImageElement;
          //@ts-ignore
          if (posterImg && posterImg.src) break;
        }

        if (!posterImg) {
          const allImages = document.querySelectorAll(
            'img[alt*="poster" i], img[alt*="Poster"]'
          );
          if (allImages.length > 0) {
            //@ts-ignore
            posterImg = allImages[0] as HTMLImageElement;
          }
        }

        if (posterImg) {
          //@ts-ignore
          const srcset = posterImg.getAttribute("srcset");

          console.log("Full srcset:", srcset);
          //@ts-ignore
          console.log("Original src:", posterImg.src);

          if (srcset) {
            const srcsetEntries = srcset.split(",").map((entry) => {
              const parts = entry.trim().split(" ");

              console.log("partspartspartsparts", parts);
              //@ts-ignore
              const url = parts[0].trim();
              const descriptor = parts[1] ? parts[1].trim() : "";
              const width = descriptor
                ? parseInt(descriptor.replace("w", ""))
                : 0;

              console.log("Parsed entry:", { url, width, descriptor });
              return { url, width };
            });

            // Sort by width descending and get the highest quality
            const highestQuality = srcsetEntries.sort(
              (a, b) => b.width - a.width
            )[0];

            console.log("Highest quality entry:", highestQuality);

            if (
              highestQuality &&
              highestQuality.width > 0 &&
              highestQuality.url &&
              highestQuality.url.startsWith("http")
            ) {
              return highestQuality.url;
            }
          }
          //@ts-ignore
          const srcUrl = posterImg.getAttribute("src") || "";
          if (srcUrl && srcUrl.startsWith("http")) {
            return srcUrl;
          }
          //@ts-ignore
          if (posterImg.src && posterImg.src.startsWith("http")) {
            //@ts-ignore
            return posterImg.src;
          }
        }

        return null;
      });

      if (posterUrl) {
        console.log("High-Quality Poster URL:", posterUrl);
        return posterUrl;
      } else {
        console.log("No poster found");
        return null;
      }
    } catch (error) {
      console.log("Poster not found or failed to load:", error);

      // Enhanced fallback: try alternative methods
      try {
        const fallbackPoster = await this.page.evaluate(() => {
          const fallbackSelectors = [
            'img[src*="amazon.com"][src*="MV5B"]',
            'img[alt*="poster" i]',
            '.ipc-image[src*="amazon.com"]',
            '[data-testid*="poster"] img',
          ];

          for (const selector of fallbackSelectors) {
            const img = document.querySelector(selector) as HTMLImageElement;
            if (
              img &&
              img.src &&
              img.src.startsWith("http") &&
              !img.src.endsWith(".jpg")
            ) {
              return img.src;
            }
          }

          return null;
        });

        return fallbackPoster;
      } catch (fallbackError) {
        console.log("Fallback poster scraping also failed:", fallbackError);
        return null;
      }
    }
  }

  async scrapeVideoSources() {
    if (!this.page) throw new Error("Page not loaded. Call start first.");

    try {
      await this.page.waitForSelector("video", { timeout: 10000 });

      const videoSources = await this.page.evaluate(() => {
        const videos = document.querySelectorAll("video");
        const sources: Array<{
          src: string;
          type?: string;
          poster?: string;
          className?: string;
          id?: string;
          preload?: string;
          controls?: boolean;
          autoplay?: boolean;
          muted?: boolean;
          loop?: boolean;
          width?: number;
          height?: number;
        }> = [];

        videos.forEach((video, index) => {
          if (video.src) {
            sources.push({
              src: video.src,
              type: video.getAttribute("type") || "video/mp4",
              poster: video.poster || "",
              className: video.className || "",
              id: video.id || `video-${index}`,
              preload: video.preload || "",
              controls: video.controls,
              autoplay: video.autoplay,
              muted: video.muted,
              loop: video.loop,
              width: video.videoWidth || video.width,
              height: video.videoHeight || video.height,
            });
          }

          const sourceElements = video.querySelectorAll("source");
          sourceElements.forEach((source, sourceIndex) => {
            if (source.src) {
              sources.push({
                src: source.src,
                type: source.type || "video/mp4",
                poster: video.poster || "",
                className: video.className || "",
                id: video.id || `video-${index}-source-${sourceIndex}`,
                preload: video.preload || "",
                controls: video.controls,
                autoplay: video.autoplay,
                muted: video.muted,
                loop: video.loop,
                width: video.videoWidth || video.width,
                height: video.videoHeight || video.height,
              });
            }
          });
        });

        return sources;
      });

      const imdbVideoSources = await this.page.evaluate(() => {
        const sources: Array<{
          src: string;
          type?: string;
          poster?: string;
          className?: string;
          id?: string;
          isIMDbPlayer?: boolean;
        }> = [];

        const jwVideos = document.querySelectorAll(
          ".jw-video, .jw-media video"
        );
        jwVideos.forEach((video: any, index) => {
          if (video.src) {
            sources.push({
              src: video.src,
              type: video.getAttribute("type") || "video/mp4",
              poster: video.poster || "",
              className: video.className || "",
              id: video.id || `imdb-video-${index}`,
              isIMDbPlayer: true,
            });
          }
        });

        const imdbVideos = document.querySelectorAll(
          'video[class*="jw"], video[class*="imdb"]'
        );
        imdbVideos.forEach((video: any, index) => {
          if (video.src) {
            sources.push({
              src: video.src,
              type: video.getAttribute("type") || "video/mp4",
              poster: video.poster || "",
              className: video.className || "",
              id: video.id || `imdb-specific-video-${index}`,
              isIMDbPlayer: true,
            });
          }
        });

        return sources;
      });

      const allSources = [...videoSources, ...imdbVideoSources];
      const uniqueSources = allSources.filter(
        (source, index, self) =>
          index === self.findIndex((s) => s.src === source.src)
      );

      console.log(`Found ${uniqueSources.length} video sources`);
      return uniqueSources;
    } catch (error) {
      console.log("Video sources not found or failed to load:", error);

      try {
        const fallbackSources = await this.page.evaluate(() => {
          const videos = document.querySelectorAll("video");
          return Array.from(videos)
            .map((video: any, index) => ({
              src: video.src || "",
              type: video.getAttribute("type") || "video/mp4",
              poster: video.poster || "",
              className: video.className || "",
              id: video.id || `fallback-video-${index}`,
            }))
            .filter((source) => source.src);
        });

        return fallbackSources;
      } catch (fallbackError) {
        console.log("Fallback video scraping also failed:", fallbackError);
        return [];
      }
    }
  }

  async scrapeBasicInfo() {
    if (!this.page) throw new Error("Page not loaded. Call start first.");

    try {
      const basicInfo = await this.page.evaluate(() => {
        const currentUrl = window.location.href;
        const imdbIdMatch = currentUrl.match(/\/title\/(tt\d+)/);
        const imdbId = imdbIdMatch ? imdbIdMatch[1] : "";
        const titleElement =
          document.querySelector('[data-testid="hero__pageTitle"]') ||
          document.querySelector('h1[data-testid="hero-title-block__title"]') ||
          document.querySelector("h1");

        const title = titleElement?.textContent?.trim() || "";

        return {
          imdbId,
          title,
        };
      });

      return basicInfo;
    } catch (error) {
      console.log("Failed to scrape basic info");
      return { imdbId: "", title: "" };
    }
  }

  async scrapeTrending(link: string) {
    await this.start(link);
    const movieList = await this.page?.$$eval(
      ".ipc-metadata-list-summary-item",
      (elements) => {
        return elements.map((element) => {
          const movieUrlElement = element.querySelector(
            ".ipc-title-link-wrapper"
          );
          const movieUrl = movieUrlElement?.getAttribute("href") || "";
          const imdbIdMatch = movieUrl.match(/\/title\/(tt\d+)/);
          const imdbId = imdbIdMatch ? imdbIdMatch[1] : "";

          return {
            imdbId,
            title:
              element.querySelector(".ipc-title__text")?.textContent?.trim() ||
              "",
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
            plot:
              element
                .querySelector(
                  ".title-description-plot-container .ipc-html-content-inner-div"
                )
                ?.textContent?.trim() || "",
            director:
              element
                .querySelector(".title-description-credit a")
                ?.textContent?.trim() || "",
            stars: Array.from(
              element.querySelectorAll(".title-description-credit a")
            )
              .slice(1)
              .map((star) => star.textContent?.trim())
              .filter(Boolean),

            posterUrl:
              element.querySelector(".ipc-image")?.getAttribute("src") || "",
            posterAlt:
              element.querySelector(".ipc-image")?.getAttribute("alt") || "",

            movieUrl,
            watchlistId:
              element
                .querySelector('[data-testid^="inline-watched-button-"]')
                ?.getAttribute("data-testid")
                ?.replace("inline-watched-button-", "") || "",

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

  async scrapeVideos() {
    if (!this.page)
      throw new Error("Page not loaded. Call scrapeMoviePage first.");

    try {
      await this.page.waitForSelector('[data-testid="grid_first_row_video"]', {
        timeout: 5000,
      });

      const videos = await this.page.$$eval(
        '[data-testid="grid_first_row_video"] .video-item',
        (elements) =>
          elements.map((el) => {
            const imgEl = el.querySelector("img.ipc-image");
            const overlayLink = el.querySelector(
              'a[data-testid^="videos-slate-overlay-"]'
            );

            return {
              title: overlayLink?.getAttribute("aria-label") || "",
              videoUrl: overlayLink?.getAttribute("href") || "",
              imageUrl: imgEl?.getAttribute("src") || "",
              imageAlt: imgEl?.getAttribute("alt") || "",
            };
          })
      );

      return videos;
    } catch (error) {
      console.log("Videos section not found or failed to load");
      return [];
    }
  }

  async scrapeImages() {
    if (!this.page)
      throw new Error("Page not loaded. Call scrapeMoviePage first.");
    try {
      await this.page.waitForSelector('section[data-testid="Photos"]', {
        timeout: 5000,
      });

      const images = await this.page.$$eval(
        'section[data-testid="Photos"] a.sc-83794ccd-0.gkzoxh img.ipc-image',
        (imgs) =>
          imgs.map((img) => ({
            src: img.getAttribute("src") || "",
            alt: img.getAttribute("alt") || "",
          }))
      );

      return images;
    } catch (error) {
      console.log("Images section not found or failed to load");
      return [];
    }
  }

  async scrapeCast() {
    if (!this.page)
      throw new Error("Page not loaded. Call scrapeMoviePage first.");
    try {
      await this.page.waitForSelector('section[data-testid="title-cast"]', {
        timeout: 5000,
      });

      const cast = await this.page.$$eval(
        'div[data-testid="title-cast-item"]',
        (elements) =>
          elements.map((el) => {
            const actorLink = el.querySelector(
              'a[data-testid="title-cast-item__actor"]'
            );
            const characterLink = el.querySelector(
              'a[data-testid="cast-item-characters-link"]'
            );
            const imgEl = el.querySelector("img.ipc-image");
            const voiceIndicator = el.querySelector(
              "span.sc-10bde568-9.dKIpPl"
            );

            return {
              actorName: actorLink?.textContent?.trim() || "",
              actorUrl: actorLink?.getAttribute("href") || "",
              characterName:
                characterLink
                  ?.querySelector("span.sc-10bde568-4.jwxYun")
                  ?.textContent?.trim() || "",
              characterUrl: characterLink?.getAttribute("href") || "",
              imageUrl: imgEl?.getAttribute("src") || "",
              imageAlt: imgEl?.getAttribute("alt") || "",
              isVoiceRole:
                voiceIndicator?.textContent?.includes("voice") || false,
            };
          })
      );

      return cast;
    } catch (error) {
      console.log("Cast section not found or failed to load");
      return [];
    }
  }

  async scrapeRatings() {
    if (!this.page)
      throw new Error("Page not loaded. Call scrapeMoviePage first.");

    try {
      await this.page.waitForSelector(
        '[data-testid="hero-rating-bar__aggregate-rating"]',
        { timeout: 5000 }
      );
      const ratings = await this.page.evaluate(() => {
        const imdbScoreElement = document.querySelector(
          '[data-testid="hero-rating-bar__aggregate-rating__score"] .sc-4dc495c1-1'
        );
        const imdbVotesElement = document.querySelector(
          '[data-testid="hero-rating-bar__aggregate-rating"] .sc-4dc495c1-3'
        );

        const metascoreElement = document.querySelector(
          ".metacritic-score-box"
        ) as HTMLElement;

        return {
          imdbScore: {
            rating: imdbScoreElement?.textContent?.trim() || "",
            totalVotes: imdbVotesElement?.textContent?.trim() || "",
            fullRating:
              imdbScoreElement?.parentElement?.textContent?.trim() || "",
          },
          metascore: {
            score: metascoreElement?.textContent?.trim() || "",
            backgroundColor: metascoreElement?.style?.backgroundColor || "",
          },
        };
      });

      return ratings;
    } catch (error) {
      console.log("Ratings section not found or failed to load");
      return null;
    }
  }

  async scrapeStoryline() {
    if (!this.page)
      throw new Error("Page not loaded. Call scrapeMoviePage first.");

    try {
      await this.page.waitForSelector('[data-testid="Storyline"]', {
        timeout: 5000,
      });
      await this.page.waitForSelector(
        '[data-testid="storyline-plot-summary"] .ipc-html-content-inner-div',
        { timeout: 8000 }
      );

      const storyline = await this.page.evaluate(() => {
        const plotSummaryElement = document.querySelector(
          '[data-testid="storyline-plot-summary"] .ipc-html-content-inner-div'
        );
        const taglineElement = document.querySelector(
          '[data-testid="storyline-taglines"] .ipc-metadata-list-item__list-content-item'
        );
        const genreElements = document.querySelectorAll(
          '[data-testid="storyline-genres"] .ipc-metadata-list-item__list-content-item'
        );
        const keywordElements = document.querySelectorAll(
          '[data-testid="storyline-plot-keywords"] a .ipc-chip__text'
        );
        const certificateElement = document.querySelector(
          '[data-testid="storyline-certificate"] .ipc-metadata-list-item__list-content-item'
        );
        const parentGuideElement = document.querySelector(
          '[data-testid="storyline-parents-guide"]'
        );

        return {
          tagline: taglineElement?.textContent?.trim() || "",
          story: plotSummaryElement?.textContent?.trim() || "",
          genres: Array.from(genreElements).map(
            (el) => el.textContent?.trim() || ""
          ),
          keywords: Array.from(keywordElements)
            .map((el) => el.textContent?.trim() || "")
            .filter((keyword) => keyword && !keyword.includes("more")),
          certificate: certificateElement?.textContent?.trim() || "",
          hasParentGuide: !!parentGuideElement,
        };
      });

      return storyline;
    } catch (error) {
      console.log("Storyline section not found or failed to load");
      return null;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}
