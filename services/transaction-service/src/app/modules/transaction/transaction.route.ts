import express from "express";
import { TransactionController } from "./transaction.controller";

const router = express.Router();

router.post(
  "/transfers/international",
  TransactionController.createInternationalTransfer,
);
router.post("/transfers/recover/:id", TransactionController.recoverTransaction);

export const TransactionRoutes = router;
