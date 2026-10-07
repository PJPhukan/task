import "server-only";
import { z } from "zod";

export const approveJoinRequestSchema = z.object({
  roleIds: z.array(z.string()).min(1, "At least one role is required"),
  projectIds: z.array(z.string()).optional(),
  boardIds: z.array(z.string()).optional(),
});

export type ApproveJoinRequestInput = z.infer<typeof approveJoinRequestSchema>;

export const rejectJoinRequestSchema = z.object({
  reason: z.string().optional(),
});

export type RejectJoinRequestInput = z.infer<typeof rejectJoinRequestSchema>;
