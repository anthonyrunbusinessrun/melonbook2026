import { NextRequest, NextResponse } from 'next/server';
import { buildARReport, exportARToExcel } from '@/lib/ar-engine';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  try {
    const report = await buildARReport({
      asOfDate: sp.get('date') ? new Date(sp.get('date')!) : new Date(),
      customerCodes: sp.get('customer') ? sp.get('customer')!.split(',') : undefined,
      includeZeroBalance: sp.get('showPaid') === 'true',
    });
    const buffer = await exportARToExcel(report);
    const dateStr = new Date().toISOString().split('T')[0];
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="RJL_AR_Report_${dateStr}.xlsx"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
