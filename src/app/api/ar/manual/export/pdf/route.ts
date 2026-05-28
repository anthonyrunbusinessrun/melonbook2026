import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { buildManualARReport, exportARToPdf } from '@/lib/ar-engine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function parseList(value: string | null) {
  return value
    ? value.split(',').map(item => item.trim()).filter(Boolean)
    : undefined;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;

  try {
    const entryIds = parseList(sp.get('entryId') || sp.get('entryIds'));
    const report = await buildManualARReport({
      asOfDate: sp.get('date') ? new Date(sp.get('date')!) : undefined,
      customerCodes: parseList(sp.get('customer')),
      entryIds,
      includeZeroBalance: sp.get('showPaid') === 'true',
    });
    const buffer = await exportARToPdf(report);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = entryIds?.length === 1
      ? `MelonBook_AR_Entry_${entryIds[0].slice(0, 8)}_${dateStr}.pdf`
      : `MelonBook_Manual_AR_${dateStr}.pdf`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
