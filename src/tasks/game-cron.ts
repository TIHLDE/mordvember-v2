import { defineTask } from "nitro/task";
import { runCron } from "@/server/cron";

export default defineTask({
  async run() {
    if (process.env.VERCEL && !process.env.CRON_SECRET) {
      throw new Error("CRON_SECRET is required on Vercel");
    }
    const result = await runCron();
    if (result.failed.length) throw new Error(`Cron failed: ${result.failed.join(", ")}`);
    return { result };
  },
});
