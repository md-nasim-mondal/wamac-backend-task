import { config } from "./config";
import app from "./app";
import { setupShutdownHandlers } from "./shared/shutdown";

const port = config.port;
let server: any;

if (process.env.NODE_ENV !== "test") {
  require("../../../tracing");
  const server = app.listen(port, () =>
    console.log("Admin-service listening on port " + port),
  );
  setupShutdownHandlers(server);
}

export default app;
