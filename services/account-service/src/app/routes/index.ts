import express from "express";
import { AccountRoutes } from "../modules/account/account.route";

const router = express.Router();

router.use("/accounts", AccountRoutes);

export default router;
