import "server-only";
import { z } from "zod";

export const patchNotificationSettingsSchema = z.object({
  emailEnabled: z.boolean(),
});

export type PatchNotificationSettingsInput = z.infer<typeof patchNotificationSettingsSchema>;
