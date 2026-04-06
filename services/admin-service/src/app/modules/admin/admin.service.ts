export const AdminService = {
  getRecentTransactions: async () => {
    return [] as Array<Record<string, unknown>>;
  },

  getLedgerAudit: async () => {
    return { chainValid: true, issues: [] } as const;
  },

  shutdownSystem: async () => {
    return { message: "Shutdown initiated" } as const;
  },
};
