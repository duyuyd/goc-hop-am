import type { Metadata } from 'next';
import RealSongLibrary from '../../components/real-song-library';
import '../real-library.css';

export const metadata: Metadata = {
  title: 'Thư viện bài hát thực tế | Góc Hợp Âm',
  description: 'Tra cứu bài hát, hợp âm và lời bài hát đã nhập vào cơ sở dữ liệu Góc Hợp Âm.',
};

export default function RealSongLibraryPage() {
  return <RealSongLibrary />;
}
