import { defineTask } from "nitro/task";
import { runCron } from "@/server/cron";

export default defineTask({
  async run() {
    const result = await runCron();
    if (result.failed.length) throw new Error(`Cron failed: ${result.failed.join(", ")}`);
    return { result };
  },
});
