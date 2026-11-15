const fs = require('node:fs');
const path = require('node:path');
const studio = require('../../public/studio-catalog');

const root = path.join(__dirname, '..', '..', 'public', 'curriculum');
const stepFolder = track => `step-${track.id.slice(1).padStart(2, '0')}`;
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

// The catalog lists the problems; each problem's full text lives in curriculum/step-NN/<id>.json.
function loadCurriculum() {
  return studio.tracks.map(track => {
    const dir = path.join(root, stepFolder(track));
    const load = ({ id }) => {
      const file = path.join(dir, `${id}.json`);
      if (!fs.existsSync(file)) throw new Error(`missing problem file: curriculum/${stepFolder(track)}/${id}.json`);
      return readJson(file);
    };
    return { ...track, level: readJson(path.join(dir, 'level.json')), problems: track.problems.map(load), exam: track.exam.map(load) };
  });
}

// Every file under curriculum/ as "folder/file" (or just "file" at the top), sorted.
function curriculumFiles() {
  return fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry =>
    entry.isDirectory()
      ? fs.readdirSync(path.join(root, entry.name)).sort().map(file => `${entry.name}/${file}`)
      : [entry.name]);
}

const loadPlacement = () => readJson(path.join(root, 'placement.json'));

module.exports = { loadCurriculum, curriculumFiles, loadPlacement, stepFolder, curriculumRoot: root };
