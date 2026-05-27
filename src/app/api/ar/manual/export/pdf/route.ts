import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { buildManualARReport, exportARToPdf } from '@/lib/ar-engine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;

  try {
    const report = await buildManualARReport({
      asOfDate: sp.get('date') ? new Date(sp.get('date')!) : new Date(),
      customerCodes: sp.get('customer') ? sp.get('customer')!.split(',') : undefined,
      includeZeroBalance: sp.get('showPaid') === 'true',
    });
    const buffer = await exportARToPdf(report);
    const dateStr = new Date().toISOString().split('T')[0];

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="MelonBook_Manual_AR_${dateStr}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
