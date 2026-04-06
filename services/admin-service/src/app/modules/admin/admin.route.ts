import express from "express";
import { AdminController } from "./admin.controller";

const router = express.Router();

router.get("/health", AdminController.getHealth);
router.get("/admin/transactions/recent", AdminController.getRecentTransactions);
router.get("/admin/ledger/audit", AdminController.getLedgerAudit);
router.post("/admin/system/shutdown", AdminController.shutdownSystem);

export const AdminRoutes = router;
