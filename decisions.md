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

7. **Data Models**
   - **Account Service:** Wallet model with encrypted owner name, balance adjustments with unique keys
   - **Transaction Service:** Transaction model with idempotency key, payload hash, status enum
   - **Ledger Service:** LedgerEntry model with double-entry fields, audit hash chain
   - **FX Service:** FxQuote model with TTL and single-use status
   - **Payroll Service:** PayrollJob model with progress tracking
   - **Admin Service:** Minimal, uses cross-service calls for operations

8. **Security & Encryption**
   Envelope encryption using AES-256-GCM for sensitive data (owner names). Master key managed via environment variables.

9. **Observability**
   - Prometheus metrics in all services
   - Jaeger distributed tracing
   - Audit hash chain for ledger integrity verification

10. **API Gateway**
    NGINX reverse proxy routes requests to appropriate services based on path.

11. **Self-Contained Deployment**
    Docker Compose includes all services, databases, Redis, monitoring stack (Prometheus/Grafana), and tracing (Jaeger).

## Requirements Fulfillment Status

✅ **All core requirements completed:**

- 6 microservices implemented with separate databases
- Idempotent disbursement handling all 5 scenarios
- Double-entry ledger with invariant enforcement
- FX rate locking with 60s TTL quotes
- Bulk payroll with BullMQ concurrency control
- Unit tests for all services
- Postman collection for API testing
- Architecture diagram (Mermaid)
- Data models with constraints and indexes
- Self-contained Docker Compose setup
- CI/CD pipeline with path-based filtering

## Tradeoffs Made

- **Microservices isolation**: No shared DBs (good for scaling) but requires cross-service calls (latency)
- **Idempotency via DB constraints**: Simple but requires careful payload hashing
- **Envelope encryption**: Secure but adds complexity; chose AES-256-GCM for field-level protection
- **BullMQ concurrency=1**: Prevents race conditions but limits throughput for large payrolls
- **No shared caching**: Each service manages its own (simplicity over performance)
