const fs = require('node:fs');
const path = require('node:path');
const studio = require('../../public/studio-catalog');

const root = path.join(__dirname, '..', '..', 'public', 'curriculum');
const stepFolder = track => `step-${track.id.slice(1).padStart(2, '0')}`;

// The catalog lists the problems; each problem's full text lives in curriculum/step-NN/<id>.json.
function loadCurriculum() {
  return studio.tracks.map(track => ({
    ...track,
    problems: track.problems.map(({ id }) => {
      const file = path.join(root, stepFolder(track), `${id}.json`);
      if (!fs.existsSync(file)) throw new Error(`missing problem file: curriculum/${stepFolder(track)}/${id}.json`);
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }),
  }));
}

function curriculumFiles() {
  return fs.readdirSync(root).sort().flatMap(folder =>
    fs.readdirSync(path.join(root, folder)).sort().map(file => `${folder}/${file}`));
}

module.exports = { loadCurriculum, curriculumFiles, stepFolder };
