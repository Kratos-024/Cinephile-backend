import dotenv from "dotenv";
dotenv.config({ path: ".env", debug: true });

import app from "./app.js";
import Scraper from "./data/scrape.js";
const port = process.env.PORT;
const scrape = new Scraper();
scrape.scrapeCompleteMovieData("https://www.imdb.com/title/tt10676052/");
app.listen(port, () => {
  console.log("Server has been started on port:", port);
  console.log("http://localhost:8000/");
});
