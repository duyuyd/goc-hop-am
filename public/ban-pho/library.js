import {foldText} from '../text.js';
import {createSongSheet} from '../mobile/song-sheet.js?v=144';

const byId = id => document.getElementById(id);
const format = count => count.toLocaleString('vi-VN');
const search = byId('search');
const collection = byId('collection');
const viewer = byId('viewer');
const scoreImage = byId('score-image');
const archive = byId('score-archive');
const sourceNames = {commons: 'Wikimedia Commons', mutopia: 'Mutopia Project'};
const normalize = value => foldText(value).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const pageSize = 24;
let items = [], filtered = [], page = 0, selected = null;
const pdfReader = createSongSheet({
  host: byId('score-pdf'), getSong: () => selected, rawPdf: true,
  getSheetPath: score => score ? '/api/open-sheet?' + new URLSearchParams({id: score.id}) : '',
  onMetadata(meta) {
    archive.hidden = !meta.archive;
    if (meta.archive) archive.href = meta.archive;
  },
});

function openScore(score) {
  selected = score;
  pdfReader.setSong();
  const isPdf = score.format === 'pdf';
  byId('score-title').textContent = score.title;
  byId('score-credit').textContent = [score.author, sourceNames[score.source], score.license].filter(Boolean).join(' · ');
  byId('score-source').href = score.sourceUrl ||
    'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=' + score.id.slice('mutopia-'.length);
  const license = byId('score-license');
  license.hidden = !score.licenseUrl;
  if (score.licenseUrl) license.href = score.licenseUrl;
  const imageLink = byId('score-image-file');
  archive.hidden = true;
  imageLink.hidden = isPdf;
  scoreImage.hidden = isPdf;
  if (!isPdf) {
    scoreImage.alt = 'Bản phổ ' + score.title;
    imageLink.href = scoreImage.src = new URL(score.asset, location.origin + '/ban-pho/').href;
  }
  viewer.showModal();
  if (isPdf) pdfReader.open();
}

viewer.onclose = () => {
  pdfReader.setSong();
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
    badge.textContent = score.format === 'pdf' ? 'PDF' : 'Ảnh';
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
      ...score, searchText: normalize([score.title, score.author, score.opus, score.instrument].filter(Boolean).join(' ')),
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
