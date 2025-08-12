import { PrismaAdapter } from '@auth/prisma-adapter';
import prisma from './db';

export const adapter = PrismaAdapter(prisma);
