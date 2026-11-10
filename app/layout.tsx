import type { Metadata } from 'next';
export const metadata: Metadata = {title:'Góc Hợp Âm · Tra cứu toàn kho',description:'Tìm bài hát, ca sĩ và nhạc sĩ trong kho hợp âm trực tuyến.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="vi"><body>{children}</body></html>}
