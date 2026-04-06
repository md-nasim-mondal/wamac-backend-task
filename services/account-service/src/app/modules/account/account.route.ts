import express from "express";
import { AccountController } from "./account.controller";

const router = express.Router();

router.get("/:id/balance", AccountController.getAccountBalance);
router.post("/", AccountController.createAccount);
router.post("/:id/adjust", AccountController.adjustBalance);
router.get("/:id/secret", AccountController.getAccountSecret);

export const AccountRoutes = router;
