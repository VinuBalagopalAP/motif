import { z } from 'zod';

// Chat Request Schema
export const ChatRequestSchema = z.object({
  message: z.string().min(1, "Message cannot be empty"),
  userId: z.string().min(1, "User ID is required"),
  chatId: z.string().optional().nullable(),
  attachments: z.array(z.object({
    url: z.string().url(),
    type: z.string(),
    name: z.string()
  })).optional().default([]),
  history: z.array(z.any()).optional().default([]), // In a full refactor, this would be strictly typed
});

// Edit Chat Request Schema
export const EditChatRequestSchema = z.object({
  jobId: z.string().min(1, "Job ID is required"),
  message: z.string().min(1, "Message cannot be empty"),
});
