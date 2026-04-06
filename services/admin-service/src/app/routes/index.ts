import express from "express";
import { AdminRoutes } from "../modules/admin/admin.route";

const router = express.Router();

router.use("/", AdminRoutes);

export default router;
