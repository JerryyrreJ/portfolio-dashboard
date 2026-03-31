import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/ownership';
import {
  buildTransactionExportFilename,
  getTransactionExportPayload,
  parseTransactionExportFormat,
  parseTransactionExportRequest,
  serializeTransactionExportCsv,
} from '@/lib/transaction-export';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const exportRequest = parseTransactionExportRequest(request.nextUrl.searchParams);
    const format = parseTransactionExportFormat(request.nextUrl.searchParams);
    const payload = await getTransactionExportPayload(user.id, exportRequest);

    if (!payload) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    const filename = buildTransactionExportFilename(format, payload);

    if (format === 'json') {
      return new NextResponse(JSON.stringify(payload, null, 2), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    return new NextResponse(serializeTransactionExportCsv(payload), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting transactions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
