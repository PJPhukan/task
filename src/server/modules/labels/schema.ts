import { z } from "zod";

export const createLabelSchema = z.object({
  name: z.string().min(1).max(255),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid color format"),
});

export const updateLabelSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid color format").optional(),
});

export const updateTaskLabelsSchema = z.object({
  labelIds: z.array(z.string()),
});

export type CreateLabelInput = z.infer<typeof createLabelSchema>;
export type UpdateLabelInput = z.infer<typeof updateLabelSchema>;
export type UpdateTaskLabelsInput = z.infer<typeof updateTaskLabelsSchema>;
