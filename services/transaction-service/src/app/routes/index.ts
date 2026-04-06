import express from "express";
import { TransactionRoutes } from "../modules/transaction/transaction.route";

const router = express.Router();

router.use("/", TransactionRoutes);

export default router;
