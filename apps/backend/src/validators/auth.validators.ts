import { z } from 'zod';

const email = z.string().trim().toLowerCase().email('Enter a valid email address');
const password = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128, 'That password is too long');

export const signupSchema = z.object({ email, password });
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({ email, password: z.string().min(1, 'Enter your password') });
export type LoginInput = z.infer<typeof loginSchema>;
