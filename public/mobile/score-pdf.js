// Package the rendered A4 pages as PDF image streams without a network dependency.
export function sheetPdfBytes(pages) {
  if (!pages.length) throw new Error('Chưa có trang để xuất PDF.');
  const encoder = new TextEncoder(), chunks = [], offsets = [0];
  let length = 0;
  function add(value) {
    const bytes = typeof value === 'string' ? encoder.encode(value) : value;
    chunks.push(bytes);
    length += bytes.byteLength;
  }
  function object(id, body, stream) {
    offsets[id] = length;
    add(id + ' 0 obj\n' + body);
    if (stream) {
      add('\nstream\n');
      add(stream);
      add('\nendstream');
    }
    add('\nendobj\n');
  }
  add('%PDF-1.4\n');
  add(new Uint8Array([37, 226, 227, 207, 211, 10]));
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, '<< /Type /Pages /Count ' + pages.length + ' /Kids [' + pages.map((_, i) => (3 + i * 3) + ' 0 R').join(' ') + '] >>');
  for (const [index, page] of pages.entries()) {
    const id = 3 + index * 3;
    const width = 539.28, height = width * page.height / page.width;
    const draw = encoder.encode('q ' + width + ' 0 0 ' + height.toFixed(3) + ' 27.998 ' + (813.892 - height).toFixed(3) + ' cm /Sheet Do Q');
    object(id, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.276 841.89] /Resources << /XObject << /Sheet ' + (id + 1) + ' 0 R >> >> /Contents ' + (id + 2) + ' 0 R >>');
    object(id + 1, '<< /Type /XObject /Subtype /Image /Width ' + page.width + ' /Height ' + page.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + page.bytes.byteLength + ' >>', page.bytes);
    object(id + 2, '<< /Length ' + draw.byteLength + ' >>', draw);
  }
  const xref = length;
  add('xref\n0 ' + offsets.length + '\n0000000000 65535 f \n');
  for (const offset of offsets.slice(1)) add(String(offset).padStart(10, '0') + ' 00000 n \n');
  add('trailer\n<< /Size ' + offsets.length + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
  const output = new Uint8Array(length);
  let position = 0;
  for (const bytes of chunks) {
    output.set(bytes, position);
    position += bytes.byteLength;
  }
  return output;
}

export async function sheetPdfFromSvg(svgs) {
  const pages = [];
  for (const svg of svgs) {
    const url = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml;charset=utf-8'}));
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = Math.round(image.naturalHeight / image.naturalWidth * canvas.width);
      const context = canvas.getContext('2d', {alpha: false});
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .94));
      if (!blob) throw new Error('Thiết bị chưa kết xuất được trang PDF.');
      pages.push({width: canvas.width, height: canvas.height, bytes: new Uint8Array(await blob.arrayBuffer())});
      canvas.width = 0;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return sheetPdfBytes(pages);
}
