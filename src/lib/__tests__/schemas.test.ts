import { describe, it, expect } from 'vitest';
import { ChatRequestSchema, EditChatRequestSchema } from '../schemas';

describe('API Boundary Schemas', () => {
  describe('ChatRequestSchema', () => {
    it('should validate a correct payload', () => {
      const validPayload = {
        message: 'Generate a video about coffee',
        userId: '12345-user',
        history: [],
      };
      
      const result = ChatRequestSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.attachments).toEqual([]);
      }
    });

    it('should reject a missing message', () => {
      const invalidPayload = {
        userId: '12345-user',
      };
      
      const result = ChatRequestSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe('EditChatRequestSchema', () => {
    it('should validate a correct edit payload', () => {
      const validPayload = {
        jobId: 'job-123',
        message: 'Wait make the text blue instead',
      };
      
      const result = EditChatRequestSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });
  });
});
