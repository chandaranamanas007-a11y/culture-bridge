// Randomizes correct answer positions across all question sets
// Uses a proper deterministic spread to get even A/B/C/D distribution

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Pre-defined target positions to guarantee good spread across 64 questions
// Pattern ensures roughly 16 each of A(0), B(1), C(2), D(3)
const TARGET_POSITIONS = [
  1, 2, 3, 0, 2, 1, 3, 0, 1, 3, 0, 2, 3, 0, 1, 2,  // set 1: 16 Qs
  2, 0, 3, 1, 0, 3, 2, 1, 3, 2, 0, 1, 0, 2, 3, 1,  // set 2: 16 Qs
  3, 1, 0, 2, 1, 0, 3, 2, 0, 3, 1, 2, 2, 3, 0, 1,  // set 3: 16 Qs
  0, 2, 1, 3, 3, 1, 0, 2, 2, 0, 3, 1, 1, 3, 2, 0,  // set 4: 16 Qs
];

let globalIndex = 0;

function randomizeQuestion(question) {
  const newCorrectIndex = TARGET_POSITIONS[globalIndex % TARGET_POSITIONS.length];
  globalIndex++;

  if (newCorrectIndex === 0) {
    // Correct answer stays at position A — no swap needed
    return { ...question, correct: 0 };
  }

  const opts = [...question.options];
  // Swap correct answer (currently at index 0) to the target position
  [opts[0], opts[newCorrectIndex]] = [opts[newCorrectIndex], opts[0]];
  return { ...question, options: opts, correct: newCorrectIndex };
}

const filePaths = [
  path.join(__dirname, 'server/custom_questions.json'),
  path.join(__dirname, 'server/data/custom_questions.json'),
];

for (const filePath of filePaths) {
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping (not found): ${filePath}`);
    continue;
  }

  globalIndex = 0; // reset for each file so both files are identical

  const raw = fs.readFileSync(filePath, 'utf8');
  const sets = JSON.parse(raw);

  const distribution = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const labels = { 0: 'A', 1: 'B', 2: 'C', 3: 'D' };

  const updated = sets.map((set, si) => ({
    ...set,
    questions: set.questions.map((q, qi) => {
      const result = randomizeQuestion(q);
      distribution[result.correct]++;
      return result;
    })
  }));

  fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf8');
  
  console.log(`✓ Updated: ${path.basename(path.dirname(filePath)) + '/' + path.basename(filePath)}`);
  console.log(`  Answer distribution: A=${distribution[0]}  B=${distribution[1]}  C=${distribution[2]}  D=${distribution[3]}`);
  
  // Print a summary of each set
  updated.forEach(set => {
    const dist = { A: 0, B: 0, C: 0, D: 0 };
    set.questions.forEach(q => dist[labels[q.correct]]++);
    console.log(`  ▸ "${set.name}": A=${dist.A} B=${dist.B} C=${dist.C} D=${dist.D}`);
  });
}

console.log('\n✅ Done! Correct answers now spread evenly across A, B, C, D.');
