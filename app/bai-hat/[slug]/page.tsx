import type { Metadata } from 'next';
import RealSongDetail from '../../../components/real-song-detail';
import '../../real-library.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Chi tiết bài hát | Góc Hợp Âm',
};

export default async function SongPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <RealSongDetail slug={slug} />;
}
