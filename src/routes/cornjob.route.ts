import { Router, type Response, type Request } from "express";

const cornRouter = Router();

cornRouter.route("/corn").get(async (req: Request, res: Response) => {
  res.json({ message: "Hello from corn route" });
});

export default cornRouter;
