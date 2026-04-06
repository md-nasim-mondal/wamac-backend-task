import { config } from "./config";
import app from "./app";
import { setupShutdownHandlers } from "./shared/shutdown";

if (process.env.NODE_ENV !== "test") {
  require("../../../tracing");
}

const port = config.port;
let server: any;

if (process.env.NODE_ENV !== "test") {
  const server = app.listen(port, () =>
    console.log("Transaction-service listening on port " + port),
  );
  setupShutdownHandlers(server);
}

export default app;
