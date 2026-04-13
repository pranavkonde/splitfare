import { withAuth, createResponse, createErrorResponse, AuthenticatedRequest } from '@/lib/api-utils';
import { ExporterService, ExportFormat } from '@/services/exporter';
import { generatePdfStream } from '@/services/pdf-generator';
import { createServerStorachaService } from '@/lib/storacha-server';
import { NextResponse } from 'next/server';

export const GET = withAuth(async (req: AuthenticatedRequest, { params }: { params: { id: string } }) => {
  try {
    const { id: groupId } = params;
    const url = new URL(req.url);
    const format = (url.searchParams.get('format') || 'json') as ExportFormat;
    const userId = req.user.id;

    const storacha = await createServerStorachaService();
    const exporter = new ExporterService(storacha);

    // 1. Log export start
    const exportId = await exporter.logExport(userId, format, groupId === 'all' ? null : groupId);

    try {
      if (groupId === 'all') {
        const data = await exporter.exportAllGroups(userId);
        await exporter.updateExportStatus(exportId, 'completed');
        return new NextResponse(data, {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="all_groups_export_${Date.now()}.json"`,
          },
        });
      }

      switch (format) {
        case 'json': {
          const data = await exporter.exportToJson(groupId);
          await exporter.updateExportStatus(exportId, 'completed');
          return new NextResponse(data, {
            headers: {
              'Content-Type': 'application/json',
              'Content-Disposition': `attachment; filename="group_${groupId}_export_${Date.now()}.json"`,
            },
          });
        }

        case 'csv': {
          const { expenses, settlements } = await exporter.exportToCsv(groupId);
          // For CSV, we'll return a zip-like structure or just two files.
          // Since it's a single response, we'll return a JSON with both CSVs for simplicity in the UI to download.
          // Or we could return a multipart response, but JSON is easier for now.
          // Actually, let's return a single CSV with a combined view if possible, or just expenses.
          // The requirement says "separate files for expenses and settlements".
          // I'll return a JSON containing both, and the UI can handle creating two blobs.
          await exporter.updateExportStatus(exportId, 'completed');
          return createResponse({ expenses, settlements });
        }

        case 'car': {
          const rootCid = await exporter.exportToCar(groupId);
          await exporter.updateExportStatus(exportId, 'completed', { rootCid });
          return createResponse({ rootCid, url: `https://${rootCid}.ipfs.storacha.link` });
        }

        case 'pdf': {
          const data = await exporter.getGroupData(groupId);
          const stream = await generatePdfStream(data);
          
          await exporter.updateExportStatus(exportId, 'completed');
          
          // @ts-ignore - renderToStream returns a Node stream which works in Next.js NextResponse
          return new NextResponse(stream as any, {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="group_${groupId}_report_${Date.now()}.pdf"`,
            },
          });
        }

        default:
          throw new Error('Invalid export format');
      }
    } catch (err: any) {
      await exporter.updateExportStatus(exportId, 'failed', { errorMessage: err.message });
      throw err;
    }
  } catch (error) {
    return createErrorResponse(error);
  }
});
