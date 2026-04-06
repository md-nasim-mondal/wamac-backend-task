import { NodeSDK } from "@opentelemetry/sdk-node";
import { JaegerExporter } from "@opentelemetry/exporter-jaeger";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

if (process.env.NODE_ENV !== "test") {
  const jaegerExporter = new JaegerExporter({
    endpoint:
      process.env.JAEGER_ENDPOINT || "http://localhost:14268/api/traces",
  });

  const sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME || "unknown-service",
    traceExporter: jaegerExporter,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();
}
