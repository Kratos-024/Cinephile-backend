import dotenv from "dotenv";
dotenv.config({ path: ".env", debug: true });

import app from "./app.js";
import Scraper from "./data/scrape.js";
const port = process.env.PORT;
const scrapper = new Scraper();
scrapper.scrapeMoviePage("https://www.imdb.com/title/tt0848228");
app.listen(port, () => {
  console.log("Server has been started on port:", port);
  console.log("http://localhost:8000/");
});
