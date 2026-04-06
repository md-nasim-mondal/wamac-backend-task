import { Queue } from "bullmq";
import IORedis from "ioredis";
import { config } from "../../config";

const connection = new IORedis(config.redisUrl, {
  maxRetriesPerRequest: null,
});

export const payrollQueue = new Queue("payrollQueue", { connection });
export { connection };
