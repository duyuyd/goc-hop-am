import { serveSongSheet } from '../../../../lib/song-sheet-sync';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  return serveSongSheet(request, file);
}
