export const publicPages = {
  '/gioi-thieu': {title:'NPT Duy · Tác giả Góc Hợp Âm',description:'Góc Hợp Âm do NPT Duy phát triển: tra hợp âm, đổi tông và tập hát cùng YouTube. Website và APK Android dùng miễn phí.'},
  '/ung-dung/': {title:'Tải Góc Hợp Âm Android miễn phí',description:'Tải APK Android của Góc Hợp Âm, tra hợp âm và ghi lại buổi tập trên thiết bị. Tác giả NPT Duy.'},
  '/': {
    title: 'Góc Hợp Âm | Tra cứu hợp âm, chuyển tông và nghe nhạc',
    description: 'Góc Hợp Âm: tìm hợp âm theo bài hát, ca sĩ, nhạc sĩ; chuyển tông, phóng lời, tự cuộn và nghe YouTube ngay cạnh lời. Tài liệu piano và organ của Thế Duy.',
  },
  '/tai-lieu': {
    title: 'Tài liệu piano & organ Thế Duy | Góc Hợp Âm',
    description: 'Khám phá bảng hòa âm 24 giọng, bộ 864 và 1.176 sơ đồ hợp âm piano, organ của Thế Duy. Xem thông tin, đặt mua và tải tài liệu trong tài khoản.',
  },
  '/huong-dan': {
    title: 'Hướng dẫn tìm hợp âm và nghe nhạc | Góc Hợp Âm',
    description: 'Cách tìm bài hát có dấu hoặc không dấu, chuyển tông, phóng lời, tự cuộn và nghe YouTube cùng hợp âm trên Góc Hợp Âm.',
  },
  '/chinh-sach': {
    title: 'Thông tin tài khoản, dữ liệu và thanh toán | Góc Hợp Âm',
    description: 'Thông tin về tài khoản, dữ liệu, quảng cáo, thanh toán QR và quyền tải tài liệu trên Góc Hợp Âm.',
  },
};

const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const safeJson = value => JSON.stringify(value).replace(/</g, '\\u003c');

// A verification tag is public metadata, never an OAuth Client ID or secret.
export function verificationToken(value) {
  if (typeof value !== 'string') throw new Error('invalid_verification');
  const input = value.trim();
  if (!input) return '';
  const token = input.startsWith('<')
    ? input.match(/^<meta\s+name=["']google-site-verification["']\s+content=["']([A-Za-z0-9_-]{10,256})["']\s*\/?\s*>$/i)?.[1]
    : input;
  if (!token || !/^[A-Za-z0-9_-]{10,256}$/.test(token)) throw new Error('invalid_verification');
  return token;
}

export function publicSeo(html, requestUrl, path, token = '') {
  const page = publicPages[path];
  if (!page) throw new Error('unknown_public_page');
  const origin = new URL(requestUrl).origin;
  const url = origin + path;
  const website = {
    '@context': 'https://schema.org', '@type': 'WebSite',
    '@id': origin + '/#website', name: 'Góc Hợp Âm', alternateName: 'Goc Hop Am',
    url: origin + '/', inLanguage: 'vi', description: publicPages['/'].description, creator:{'@type':'Person',name:'NPT Duy',url:origin+'/gioi-thieu'},sameAs:['https://github.com/duyuyd/goc-hop-am'],
  };
  let tags = `<title>${escape(page.title)}</title><meta name="description" content="${escape(page.description)}"><meta name="robots" content="index, follow, max-image-preview:large"><link rel="canonical" href="${escape(url)}"><meta property="og:site_name" content="Góc Hợp Âm"><meta property="og:locale" content="vi_VN"><meta property="og:type" content="website"><meta property="og:title" content="${escape(page.title)}"><meta property="og:description" content="${escape(page.description)}"><meta property="og:url" content="${escape(url)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(page.title)}"><meta name="twitter:description" content="${escape(page.description)}">`;
  tags += `<meta name="author" content="NPT Duy"><meta property="og:image" content="${escape(origin)}/share-card.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:image" content="${escape(origin)}/share-card.png">`;
  if (path === '/') {
    tags += `<script type="application/ld+json">${safeJson(website)}</script>`;
    if (token) tags += `<meta name="google-site-verification" content="${escape(verificationToken(token))}">`;
  }
  return html.replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name=["'](?:description|robots)["'][^>]*>/gi, '')
    .replace('</head>', tags + '</head>');
}

export function sitemap(requestUrl) {
  const origin = new URL(requestUrl).origin;
  return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    + Object.keys(publicPages).map(path => '<url><loc>' + escape(origin + path) + '</loc></url>').join('') + '</urlset>';
}
