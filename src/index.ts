import dotenv from "dotenv";
import app from "./app.js";

dotenv.config({ path: ".env", debug: true });

const port = process.env.PORT;
app.listen(port, () => {
  console.log("Server has been started on port:", port);
  console.log("http://localhost:8000/", port);
});
