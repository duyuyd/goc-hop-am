import {foldText} from '../text.js';
import {createSongSheet} from '../mobile/song-sheet.js?v=144';

const byId = id => document.getElementById(id);
const format = count => count.toLocaleString('vi-VN');
const search = byId('search');
const collection = byId('collection');
const viewer = byId('viewer');
const scoreImage = byId('score-image');
const archive = byId('score-archive');
const pdfHost = byId('score-pdf');
const xmlHost = byId('score-xml');
const xmlStatus = byId('xml-status');
const sourceNames = {commons: 'Wikimedia Commons', mutopia: 'Mutopia Project', lieder: 'OpenScore Lieder', quartets: 'OpenScore Tứ tấu'};
const openScorePages = {
  lieder: 'https://fourscoreandmore.org/openscore/lieder/',
  quartets: 'https://fourscoreandmore.org/openscore/stringquartets/',
};
const normalize = value => foldText(value).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const pageSize = 24;
let items = [], filtered = [], page = 0, selected = null, xmlRequest = 0, xmlEngine;
const scorePath = score => '/api/open-sheet?' + new URLSearchParams({id: score.id});
const pdfReader = createSongSheet({
  host: pdfHost, getSong: () => selected, rawPdf: true,
  getSheetPath: score => score ? scorePath(score) : '',
  onMetadata(meta) {
    archive.hidden = !meta.archive;
    if (meta.archive) archive.href = meta.archive;
    pdfHost.classList.toggle('has-parts', (meta.files?.length || 0) > 1);
  },
});

function loadXmlEngine() {
  if (!xmlEngine) {
    xmlEngine = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/ban-pho/vendor/opensheetmusicdisplay-2.3.0.min.js';
      script.onload = () => {
        const Renderer = window.opensheetmusicdisplay?.OpenSheetMusicDisplay;
        if (Renderer) resolve(Renderer);
        else reject(new Error('Bộ đọc MusicXML chưa sẵn sàng.'));
      };
      script.onerror = () => reject(new Error('Chưa tải được bộ đọc MusicXML.'));
      document.head.append(script);
    }).catch(error => { xmlEngine = null; throw error; });
  }
  return xmlEngine;
}

async function renderXml(score, path, request) {
  xmlStatus.textContent = 'Đang đọc bản phổ MusicXML…';
  try {
    const Renderer = await loadXmlEngine();
    if (request !== xmlRequest) return;
    const notation = document.createElement('div');
    xmlHost.replaceChildren(notation);
    const renderer = new Renderer(notation, {backend: 'svg', autoResize: false, drawTitle: true});
    await renderer.load(path);
    if (request !== xmlRequest || selected !== score) return;
    renderer.render();
    xmlStatus.textContent = 'Bản phổ MusicXML từ OpenScore.';
  } catch {
    if (request === xmlRequest) xmlStatus.textContent = 'Chưa hiển thị được bản phổ. Có thể tải MusicXML gốc.';
  }
}

function openScore(score) {
  const request = ++xmlRequest;
  selected = score;
  pdfReader.setSong();
  const isPdf = score.format === 'pdf';
  const isXml = score.format === 'mxl';
  const isImage = !isPdf && !isXml;
  const isOpenScore = Object.hasOwn(openScorePages, score.source);
  byId('score-title').textContent = score.title;
  byId('score-credit').textContent = [score.author, sourceNames[score.source], score.license || (isOpenScore ? 'CC0 1.0' : '')].filter(Boolean).join(' · ');
  byId('score-source').href = score.sourceUrl || openScorePages[score.source] ||
    'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=' + score.id.slice('mutopia-'.length);
  const license = byId('score-license');
  license.hidden = !score.licenseUrl && !isOpenScore;
  if (!license.hidden) license.href = score.licenseUrl || 'https://creativecommons.org/publicdomain/zero/1.0/';
  const imageLink = byId('score-image-file');
  archive.hidden = true;
  pdfHost.classList.remove('has-parts');
  imageLink.hidden = scoreImage.hidden = !isImage;
  xmlHost.hidden = xmlStatus.hidden = byId('score-mxl-file').hidden = !isXml;
  xmlHost.replaceChildren();
  if (isImage) {
    scoreImage.alt = 'Bản phổ ' + score.title;
    imageLink.href = scoreImage.src = new URL(score.asset, location.origin + '/ban-pho/').href;
  }
  viewer.showModal();
  if (isPdf) pdfReader.open();
  if (isXml) {
    const path = location.origin + scorePath(score) + '&file=0&download=1&name=' + score.id + '.mxl';
    byId('score-mxl-file').href = path;
    renderXml(score, path, request);
  }
}

viewer.onclose = () => {
  if (viewer.open) return;
  ++xmlRequest;
  pdfReader.setSong();
  xmlHost.replaceChildren();
  scoreImage.removeAttribute('src');
  selected = null;
};

function render() {
  const rows = filtered.slice(page * pageSize, (page + 1) * pageSize).map(score => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'score';
    const heading = document.createElement('span');
    heading.className = 'score-title';
    heading.textContent = score.title;
    const details = document.createElement('span');
    details.className = 'score-details';
    details.textContent = [score.author, score.opus, score.instrument, sourceNames[score.source]].filter(Boolean).join(' · ');
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = {pdf: 'PDF', mxl: 'MusicXML', png: 'Ảnh'}[score.format] || 'Bản phổ';
    button.append(heading, details, badge);
    button.onclick = () => openScore(score);
    li.append(button);
    return li;
  });
  byId('scores').replaceChildren(...rows);
  byId('count').textContent = filtered.length ? format(filtered.length) + ' bản phổ' : 'Chưa tìm thấy bản phổ phù hợp.';
  const pages = Math.ceil(filtered.length / pageSize);
  byId('pagination').hidden = pages <= 1;
  byId('previous').disabled = page === 0;
  byId('next').disabled = page + 1 >= pages;
  byId('page').textContent = (page + 1) + ' / ' + pages;
}

function filter() {
  const words = normalize(search.value).split(' ').filter(Boolean);
  filtered = items.filter(score =>
    (!collection.value || score.source === collection.value) && words.every(word => score.searchText.includes(word))
  );
  page = 0;
  render();
}

search.oninput = collection.onchange = filter;
for (const [id, direction] of [['previous', -1], ['next', 1]]) {
  byId(id).onclick = () => {
    page += direction;
    render();
    byId('results-title').scrollIntoView({block: 'start'});
  };
}

async function load() {
  try {
    const response = await fetch('/ban-pho/catalog.json');
    if (!response.ok) throw new Error('catalog_unavailable');
    const catalog = await response.json();
    items = catalog.items.map(score => ({
      ...score, searchText: normalize([score.title, score.author, score.lyricist, score.opus, score.instrument].filter(Boolean).join(' ')),
    }));
    for (const option of collection.options) {
      const count = option.value ? items.filter(score => score.source === option.value).length : items.length;
      option.textContent += ' · ' + format(count);
    }
    const query = new URLSearchParams(location.search);
    search.value = (query.get('q') || '').slice(0, 120);
    if (Object.hasOwn(sourceNames, query.get('source'))) collection.value = query.get('source');
    filter();
  } catch {
    byId('count').textContent = 'Chưa tải được danh mục. Hãy tải lại trang.';
  }
}
load();
