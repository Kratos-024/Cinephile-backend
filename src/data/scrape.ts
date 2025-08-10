async scrapeLanguages() {
  if (!this.page)
    throw new Error("Page not loaded. Call scrapeMoviePage first.");

  try {
    await this.page.waitForSelector('[data-testid="title-details-section"]', {
      timeout: 5000,
    });

    const languages = await this.page.evaluate(() => {
      // Look for the language section in technical specs or details
      const languageSelectors = [
        '[data-testid="title-details-languages"] .ipc-metadata-list-item__list-content-item',
        '[data-testid="storyline-languages"] .ipc-metadata-list-item__list-content-item',
        '.ipc-metadata-list-item:has([data-testid="title-details-languages"]) .ipc-metadata-list-item__list-content-item',
        // Fallback selectors
        'li[data-testid*="language"] .ipc-metadata-list-item__list-content-item',
        '.ipc-metadata-list-item__label:contains("Language") + .ipc-metadata-list-item__list-content-item'
      ];

      let languageElements = [];
      
      for (const selector of languageSelectors) {
        languageElements = Array.from(document.querySelectorAll(selector));
        if (languageElements.length > 0) break;
      }

      // If still not found, try a more general approach
      if (languageElements.length === 0) {
        const allLabels = document.querySelectorAll('.ipc-metadata-list-item__label');
        for (const label of allLabels) {
          if (label.textContent?.toLowerCase().includes('language')) {
            const parent = label.closest('.ipc-metadata-list-item');
            const contentItems = parent?.querySelectorAll('.ipc-metadata-list-item__list-content-item');
            if (contentItems) {
              languageElements = Array.from(contentItems);
              break;
            }
          }
        }
      }

      return languageElements.map(el => ({
        name: el.textContent?.trim() || "",
        url: el.querySelector('a')?.getAttribute('href') || ""
      }));
    });

    return languages;
  } catch (error) {
    console.log("Languages section not found or failed to load");
    return [];
  }
}
