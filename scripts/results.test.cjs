const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseRoute, resultHash, withRefs, wordCount } = require('../main.js');
const { results, more } = require('../assets/results.json');
const root = path.resolve(__dirname, '..');
const paper = [path.join(root, 'AI4Love/AI4Love'), path.resolve(root, '../AI4Love')]
  .find((candidate) => fs.existsSync(path.join(candidate, 'experiment.tex')));

test('every example and view round-trips through a stable paper link', () => {
  for (const item of results) for (const view of ['collage','comparison']) {
    assert.deepEqual(parseRoute(resultHash(item.id, view), results), { id:item.id, view, invalid:false });
  }
});
test('keyframe links already printed in the paper open the story view', () => {
  for (const item of results) {
    assert.deepEqual(parseRoute(`#results/${item.id}/keyframes`, results), { id:item.id, view:'collage', invalid:false });
  }
});
test('each paper result offers a distinct input video', () => {
  const ids = results.map((item) => item.inputVideo);
  assert.equal(ids.length, 11);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => /^[A-Za-z0-9_-]+$/.test(id)));
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(html.includes('id="video-dialog"') && html.includes('id="video-frame"'));
});
test('unknown links fall back visibly without losing a valid example', () => {
  assert.deepEqual(parseRoute('#results/garfield/unknown', results), { id:'garfield', view:'collage', invalid:true });
  assert.deepEqual(parseRoute('#results/unknown/comparison', results), { id:'10-lives', view:'comparison', invalid:true });
  assert.equal(parseRoute('#comparison', results).view, 'comparison');
  assert.equal(parseRoute('', results).id, '10-lives');
  assert.equal(parseRoute('#results/garfield', results).view, 'collage');
});
test('every story cites only keyframes that exist, in order', () => {
  for (const item of results) {
    assert.ok(item.story && item.look && fs.existsSync(path.join(root, item.thumb)), item.id);
    const cited = [...item.story.matchAll(/\((\d{2})(?:–(\d{2}))?\)/g)].flatMap((m) => [Number(m[1]), Number(m[2] || m[1])]);
    assert.equal(cited[0], 1, item.id);
    assert.equal(cited.at(-1), item.keyframes.length, item.id);
    assert.ok(cited.every((n, i) => !i || n >= cited[i - 1]), item.id);
    assert.ok(wordCount(item.story) <= 100, item.id);
    assert.ok(!withRefs(item.story).includes('('), item.id);
  }
});
test('the opening example repeats the published Garfield story', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const words = html.match(/<article class="intro-words">[\s\S]*?<p>([\s\S]*?)<\/p>/)[1];
  const item = results.find((x) => x.id === 'garfield');
  assert.equal(words, withRefs(item.story));
  assert.ok(html.includes(`${wordCount(item.story)} WORDS`));
  assert.equal((html.match(/class="key-frames"[\s\S]*?<\/ol>/)[0].match(/<li>/g) || []).length, item.keyframes.length);
});
test('all exported outputs and keyframes match paper assets byte for byte', { skip: !paper && 'paper sources removed' }, () => {
  const names = { 'your-name':'Your_name', '10-lives':'10_Lives', 'cat':'Cat', 'garfield':'Garfield', 'house-of-magic':'House_of_Magic', 'imaginary':'Imaginary', 'secret-life-of-pets':'Secret_Life_Of_Pets', 'dog-tale':'Dog_tale', 'our-days':'Our_Days', 'luca':'Luca', 'chococat':'Chococat' };
  assert.equal(new Set(results.map(x => x.id)).size, results.length);
  assert.equal(results.length, 11);
  for (const item of results) {
    assert.deepEqual(Object.keys(item.comparison), ['iscp','colla'], item.id);
    for (const [method, file] of Object.entries({ ...item.outputs, ...item.comparison })) {
      const source = path.join(paper,'images/comparison/final',method,`${names[item.id]}.png`);
      assert.ok(fs.readFileSync(path.join(root,file)).equals(fs.readFileSync(source)),file);
    }
    for (const frame of item.keyframes) {
      const source = path.join(paper,'images/method/KEYFRAME_FILTER',names[item.id],path.basename(frame.src));
      assert.ok(fs.readFileSync(path.join(root,frame.src)).equals(fs.readFileSync(source)),frame.src);
    }
  }
  assert.ok(fs.readFileSync(path.join(root,'assets/results/framework.jpg')).equals(fs.readFileSync(path.join(paper,'images/method/framework.jpg'))));
});
test('extra examples carry all four methods and only files that will be published', () => {
  const ids = new Set(results.map((x) => x.id));
  assert.equal(more.length, 10);
  for (const item of more) {
    assert.ok(!ids.has(item.id) && !ids.has(`more-${item.id}`), item.id);
    assert.deepEqual(Object.keys(item.outputs), ['ours','iscp','colla','sc'], item.id);
    for (const file of [...Object.values(item.outputs).flatMap((o) => [o.src, o.view]), ...item.keyframes.flatMap((f) => [f.src, f.thumb])]) {
      assert.ok(file.startsWith('assets/results/') && fs.existsSync(path.join(root, file)), file);
    }
  }
  assert.equal(more.filter((x) => x.keyframes.length).length, 5);
});
test('the page only needs assets/results and assets/results.json', () => {
  const used = new Set(JSON.stringify({ results, more }).match(/assets\/[^"]+/g));
  for (const file of ['index.html','main.js','style.css']) {
    for (const ref of fs.readFileSync(path.join(root, file), 'utf8').match(/assets\/[\w.\/-]+\.(?:png|jpg|webp|json)/g) || []) used.add(ref);
  }
  for (const ref of used) {
    assert.ok(ref === 'assets/results.json' || ref.startsWith('assets/results/'), ref);
    assert.ok(fs.existsSync(path.join(root, ref)), ref);
  }
});
