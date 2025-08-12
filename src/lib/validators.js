import { z } from 'zod';

export const emailSchema = z.string().email().endsWith('@capplc.com');

export const signInSchema = z.object({
  email: emailSchema,
});

export const cycleSchema = z.object({
  name: z.string().min(1),
  maxItemsPerUser: z.number().int().min(1),
  openAt: z.date().optional(),
  closeAt: z.date().optional(),
});

export const itemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  totalQty: z.number().int().min(1),
  maxQtyPerUser: z.number().int().min(1),
});

export const bidSubmitSchema = z.object({
  selections: z.array(z.object({
    itemId: z.string(),
    qty: z.number().int().min(1),
  })),
  idempotencyKey: z.string().uuid(),
});
