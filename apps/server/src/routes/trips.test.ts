import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validate, joinTripSchema, updateMemberRoleSchema } from '../validation/schemas.js';

describe('Trip Validation Schemas', () => {
  describe('joinTripSchema', () => {
    it('should accept a valid invite code', () => {
      const result = joinTripSchema.safeParse({ inviteCode: 'abc123xyz0' });
      expect(result.success).toBe(true);
    });

    it('should reject empty invite code', () => {
      const result = joinTripSchema.safeParse({ inviteCode: '' });
      expect(result.success).toBe(false);
    });

    it('should reject missing invite code', () => {
      const result = joinTripSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('updateMemberRoleSchema', () => {
    it('should accept editor role', () => {
      const result = updateMemberRoleSchema.safeParse({ role: 'editor' });
      expect(result.success).toBe(true);
    });

    it('should accept viewer role', () => {
      const result = updateMemberRoleSchema.safeParse({ role: 'viewer' });
      expect(result.success).toBe(true);
    });

    it('should reject owner role', () => {
      const result = updateMemberRoleSchema.safeParse({ role: 'owner' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid role values', () => {
      const result = updateMemberRoleSchema.safeParse({ role: 'admin' });
      expect(result.success).toBe(false);
    });

    it('should reject missing role', () => {
      const result = updateMemberRoleSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
