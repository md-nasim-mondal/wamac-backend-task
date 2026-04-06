import { config } from "./config";
import app from "./app";

const port = config.port;
let server: any;

if (process.env.NODE_ENV !== "test") {
  require("../../../tracing");
  server = app.listen(port, () =>
    console.log("Admin-service listening on port " + port),
  );
}

const shutdown = (exitCode = 0) => {
  if (server) {
    server.close(() => process.exit(exitCode));
  } else {
    process.exit(exitCode);
  }
};

process.on("unhandledRejection", (err) => {
  console.log(`😈 Unhandled Rejection is detected, shutting down ...`, err);
  shutdown(1);
});

process.on("uncaughtException", (err) => {
  console.log(`😈 Uncaught Exception is detected, shutting down ...`, err);
  process.exit(1);
});

process.on("SIGINT", () => {
  console.log("SIGINT signal received... Server shutting down..");
  shutdown(0);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM signal received... Server shutting down..");
  shutdown(0);
});

export default app;
