import express from "express";
import { FxController } from "./fx.controller";

const router = express.Router();

router.post("/fx/quote", FxController.createQuote);
router.get("/fx/quote/:id", FxController.getQuote);
router.post("/fx/quote/:id/use", FxController.useQuote);

export const FxRoutes = router;
