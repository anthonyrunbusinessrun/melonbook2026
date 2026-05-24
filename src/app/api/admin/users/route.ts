import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query, queryOne } from '@/db';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1, 'Name is required').max(120),
  role: z.enum(['admin', 'user']).default('user'),
  password: z.string().min(10, 'Password must be at least 10 characters'),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id?: string; email?: string; role?: string } | undefined;

  if (sessionUser?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const parsed = createUserSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid user' }, { status: 400 });
  }

  const input = parsed.data;
  const existing = await queryOne<{ id: string }>(
    'SELECT id FROM app_users WHERE email = $1',
    [input.email.toLowerCase()]
  );
  if (existing) {
    return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
  }

  const hash = await bcrypt.hash(input.password, 12);
  const [created] = await query<{ id: string }>(`
    INSERT INTO app_users (email, name, role, hashed_password)
    VALUES ($1, $2, $3, $4)
    RETURNING id
  `, [input.email.toLowerCase(), input.name, input.role, hash]);

  await query(`
    INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, new_values)
    VALUES ($1, $2, 'create_user', 'app_users', $3, $4)
  `, [
    sessionUser.id || null,
    sessionUser.email || null,
    created.id,
    JSON.stringify({ email: input.email.toLowerCase(), name: input.name, role: input.role }),
  ]);

  return NextResponse.json({ success: true, id: created.id });
}
