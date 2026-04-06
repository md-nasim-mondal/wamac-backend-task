import express from "express";
import { LedgerController } from "./ledger.controller";

const router = express.Router();

router.post("/entries", LedgerController.createLedgerEntries);
router.get(
  "/transaction/:transactionId",
  LedgerController.getTransactionLedger,
);
router.get("/audit/verify", LedgerController.verifyAuditChain);

export const LedgerRoutes = router;
