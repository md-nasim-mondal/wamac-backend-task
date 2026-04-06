import express from "express";
import { LedgerRoutes } from "../modules/ledger/ledger.route";

const router = express.Router();

router.use("/ledger", LedgerRoutes);

export default router;
