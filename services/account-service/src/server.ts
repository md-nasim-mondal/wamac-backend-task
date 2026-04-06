import { config } from "./config";
import app from "./app";

if (process.env.NODE_ENV !== "test") {
  require("../../../tracing");
}

const port = config.port;

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () =>
    console.log("Account-service listening on port " + port),
  );
}

export default app;
