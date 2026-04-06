import { config } from "./config";
import app from "./app";

const port = config.port;

if (process.env.NODE_ENV !== "test") {
  require("../../../tracing");
  app.listen(port, () =>
    console.log("Admin-service listening on port " + port),
  );
}

export default app;
