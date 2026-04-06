import express from "express";
import { FxRoutes } from "../modules/fx/fx.route";

const router = express.Router();

router.use("/", FxRoutes);

export default router;
