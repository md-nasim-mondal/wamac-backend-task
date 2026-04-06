export const setupShutdownHandlers = (server?: any) => {
  const shutdown = (exitCode: number = 0) => {
    if (server) {
      server.close(() => {
        console.log("Server closed gracefully.");
        process.exit(exitCode);
      });
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
};
