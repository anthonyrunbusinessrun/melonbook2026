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
  role: z.enum(['admin', 'user', 'accounting', 'sales_logistics', 'readonly']).default('user'),
  password: z.string().min(10, 'Password must be at least 10 characters'),
});

const updateUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().trim().min(1, 'Name is required').max(120),
  role: z.enum(['admin', 'user', 'accounting', 'sales_logistics', 'readonly']),
  isActive: z.boolean(),
  password: z.string().optional().transform(value => value?.trim() || undefined),
}).refine(value => !value.password || value.password.length >= 10, {
  message: 'Password must be at least 10 characters',
  path: ['password'],
});

const deleteUserSchema = z.object({
  id: z.string().uuid(),
});

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id?: string; email?: string; role?: string } | undefined;

  if (sessionUser?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }
  return { sessionUser };
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const users = await query(`
    SELECT id, email, name, role, is_active, last_login_at, created_at, updated_at
    FROM app_users
    ORDER BY created_at
  `);

  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { sessionUser } = auth;

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

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { sessionUser } = auth;

  const parsed = updateUserSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid user update' }, { status: 400 });
  }

  const input = parsed.data;
  const existing = await queryOne<{
    id: string;
    email: string;
    name: string;
    role: string;
    is_active: boolean;
  }>('SELECT id, email, name, role, is_active FROM app_users WHERE id = $1', [input.id]);

  if (!existing) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (sessionUser.id === input.id && (!input.isActive || input.role !== existing.role)) {
    return NextResponse.json({ error: 'You cannot deactivate yourself or change your own role' }, { status: 400 });
  }

  const duplicate = await queryOne<{ id: string }>(
    'SELECT id FROM app_users WHERE lower(email) = lower($1) AND id <> $2',
    [input.email, input.id]
  );
  if (duplicate) {
    return NextResponse.json({ error: 'A different user already has that email' }, { status: 409 });
  }

  const updates = [
    input.email.toLowerCase(),
    input.name,
    input.role,
    input.isActive,
    input.id,
  ];
  let passwordSql = '';

  if (input.password) {
    const hash = await bcrypt.hash(input.password, 12);
    updates.push(hash);
    passwordSql = `, hashed_password = $${updates.length}`;
  }

  await query(`
    UPDATE app_users
    SET email = $1,
        name = $2,
        role = $3,
        is_active = $4,
        updated_at = NOW()
        ${passwordSql}
    WHERE id = $5
  `, updates);

  await query(`
    INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, old_values, new_values)
    VALUES ($1, $2, 'update_user', 'app_users', $3, $4, $5)
  `, [
    sessionUser.id || null,
    sessionUser.email || null,
    input.id,
    JSON.stringify(existing),
    JSON.stringify({
      email: input.email.toLowerCase(),
      name: input.name,
      role: input.role,
      is_active: input.isActive,
      password_changed: Boolean(input.password),
    }),
  ]);

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { sessionUser } = auth;

  const body = await request.json().catch(() => ({}));
  const parsed = deleteUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'User id is required' }, { status: 400 });
  }

  const { id } = parsed.data;
  if (sessionUser.id === id) {
    return NextResponse.json({ error: 'You cannot delete your own admin account' }, { status: 400 });
  }

  const existing = await queryOne<{
    id: string;
    email: string;
    name: string;
    role: string;
    is_active: boolean;
  }>('SELECT id, email, name, role, is_active FROM app_users WHERE id = $1', [id]);

  if (!existing) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  await query(`
    UPDATE app_users
    SET is_active = false,
        updated_at = NOW()
    WHERE id = $1
  `, [id]);

  await query(`
    INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, old_values, new_values)
    VALUES ($1, $2, 'delete_user', 'app_users', $3, $4, $5)
  `, [
    sessionUser.id || null,
    sessionUser.email || null,
    id,
    JSON.stringify(existing),
    JSON.stringify({ is_active: false, deletion_mode: 'deactivated_to_preserve_audit_history' }),
  ]);

  return NextResponse.json({ success: true });
}
