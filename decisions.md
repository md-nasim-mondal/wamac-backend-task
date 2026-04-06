# Architectural Decisions

1. **Microservices Isolation**
   We opted to separate logical concerns into independent node services: `account-service`, `transaction-service`, `ledger-service`, `fx-service`, `payroll-service`, `admin-service`. Each interacts over HTTPS/REST to avoid sharing database state.

2. **Idempotency Strategy**
   - **Scenario A (Same key twice):** Prisma `P2002` constraint handles duplicate inserts gracefully, bypassing processing.
   - **Scenario B (Three within 100ms):** Also caught by unique constraint at database engine layer (Row-level lock).
   - **Scenario C (Sender debited, crash before recipient credited - Atomicity):** In our system, the Ledger ensures atomic cross-account transfers. The Transaction service only issues synchronous `$transaction` blocks on the ledger.
   - **Scenario D (Key expired 24h):** If older than 24h, we raise an HTTP 400.
   - **Scenario E (Payload mismatch):** Handled via an SHA-256 hash comparison stored at insert time.

3. **Double-Entry Ledger**
   The invariant rule `Sum(Debit) == Sum(Credit)` is strictly enforced inside the Ledger service API before reaching the ORM transaction to ensure precision limits, preventing vanishing money. Check `ledgerInvariantViolations` in prometheus.

4. **FX Lock Strategy**
   Provides an explicit Quote mechanism with a 60s TTL. Redeeming the quote changes its status atomically to `USED`, satisfying single-use strictness.

5. **Payroll Processing**
   Use BullMQ. Implemented a `queue.add` job and a `Worker` specifying `concurrency: 1`. This isolates multi-record employer DB mutations cleanly.

6. **Missing Elements (Production prep)**
   - API Gateway rate limiting.
   - Real Vault/KMS implementation for Field Level Encryption (currently using basic hashing mechanics).
