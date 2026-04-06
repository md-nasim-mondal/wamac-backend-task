import { Request, Response } from "express";
import { AdminService } from "./admin.service";

export const AdminController = {
  getHealth: (_req: Request, res: Response) => {
    res.send("Admin OK");
  },

  getRecentTransactions: async (_req: Request, res: Response) => {
    const transactions = await AdminService.getRecentTransactions();
    res.json({ transactions });
  },

  getLedgerAudit: async (_req: Request, res: Response) => {
    const audit = await AdminService.getLedgerAudit();
    res.json(audit);
  },

  shutdownSystem: async (_req: Request, res: Response) => {
    const result = await AdminService.shutdownSystem();
    res.json(result);
    process.exit(0);
  },
};
