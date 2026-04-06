import express from "express";
import { PayrollRoutes } from "../modules/payroll/payroll.route";

const router = express.Router();

router.use("/", PayrollRoutes);

export default router;
