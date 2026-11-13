import type { Metadata } from 'next';
import { AudioUpload } from './audio-upload';
import styles from './audio-upload.module.css';

export const metadata: Metadata = {
  title: 'Tạo Sheet bằng AI · Góc Hợp Âm',
  robots: { index: false, follow: true },
};

export default function AudioSheetPage() {
  return <main className={styles.page}>
    <a className={styles.brand} href="/">← Góc Hợp Âm</a>
    <h1>Tạo Sheet bằng AI</h1>
    <AudioUpload />
  </main>;
}
