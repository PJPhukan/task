import { z } from "zod";

export const uploadSignatureSchema = z.object({
  projectId: z.string().cuid(),
  kind: z.enum(["attachment", "avatar"]),
});

export const createAttachmentSchema = z.object({
  publicId: z.string().min(1),
  originalName: z.string().min(1).max(255),
});

export type UploadSignatureInput = z.infer<typeof uploadSignatureSchema>;
export type CreateAttachmentInput = z.infer<typeof createAttachmentSchema>;
