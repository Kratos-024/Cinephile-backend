import dotenv from "dotenv";
dotenv.config({ path: ".env", debug: true });

import app from "./app.js";
const port = process.env.PORT;
app.listen(port, () => {
  console.log("Server has been started on port:", port);
  console.log("http://localhost:8000/");
});
