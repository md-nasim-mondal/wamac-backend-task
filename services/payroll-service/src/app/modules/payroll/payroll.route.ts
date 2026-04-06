import express from "express";
import { PayrollController } from "./payroll.controller";

const router = express.Router();

router.post("/payroll/bulk", PayrollController.enqueuePayroll);

export const PayrollRoutes = router;
