/* =========================================================
   DOE Generator – Fractional Factorial, Plackett-Burman, CCD
   lib/doe-generator.js
   ========================================================= */

/* ── Standard 2-level Yates order base generator ────────── */
function fullFactorial2k(k) {
  const n = Math.pow(2, k);
  const design = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < k; j++) {
      const period = Math.pow(2, k - j - 1);
      row.push(Math.floor(i / period) % 2 === 0 ? -1 : 1);
    }
    design.push(row);
  }
  return design;
}

/* ── Apply fractional factorial generators ───────────────── */
// generators: array of arrays of 0-based column indices whose product gives a new column
function applyGenerators(baseCols, design, generators) {
  return design.map(row => {
    const extended = [...row];
    for (const gen of generators) {
      const val = gen.reduce((prod, idx) => prod * row[idx], 1);
      extended.push(val);
    }
    return extended;
  });
}

/* ── Fractional Factorial lookup table ───────────────────── */
// Returns {matrix, resolution, runType, description}
function fractionalFactorial(k, preferSmall = false) {
  // base columns for the factorial part
  // We'll always build from a smaller full factorial + generators

  if (k <= 3) {
    const m = fullFactorial2k(k);
    return {
      matrix: m,
      resolution: k < 3 ? 'Full Factorial' : 'Full Factorial (2³)',
      designType: `2^${k} Full Factorial`,
      factorialRuns: m.length,
      centerPoints: 4,
      description: `A full 2^${k} factorial with ${m.length} runs. Estimates all main effects and interactions without aliasing.`
    };
  }

  if (k === 4) {
    // 2^4-1 = 8 runs, generator D=ABC, Resolution IV
    const base = fullFactorial2k(3);
    const matrix = applyGenerators(3, base, [[0, 1, 2]]); // D = A*B*C
    return {
      matrix,
      resolution: 'Resolution IV',
      designType: '2^(4-1) Fractional Factorial',
      factorialRuns: 8,
      centerPoints: 4,
      description: 'A half-fraction (2^4-1) with 8 factorial runs. Generator: D=ABC. Resolution IV – main effects are clear of 2FIs.'
    };
  }

  if (k === 5 && preferSmall) {
    // 2^5-2 = 8 runs, generators D=AB, E=AC, Resolution III
    const base = fullFactorial2k(3);
    const matrix = applyGenerators(3, base, [[0, 1], [0, 2]]); // D=AB, E=AC
    return {
      matrix,
      resolution: 'Resolution III',
      designType: '2^(5-2) Fractional Factorial',
      factorialRuns: 8,
      centerPoints: 4,
      description: 'A quarter-fraction (2^5-2) with 8 runs. Generators: D=AB, E=AC. Resolution III – main effects estimable but aliased with 2FIs.'
    };
  }

  if (k === 5) {
    // 2^5-1 = 16 runs, generator E=ABCD, Resolution V
    const base = fullFactorial2k(4);
    const matrix = applyGenerators(4, base, [[0, 1, 2, 3]]); // E = A*B*C*D
    return {
      matrix,
      resolution: 'Resolution V',
      designType: '2^(5-1) Fractional Factorial',
      factorialRuns: 16,
      centerPoints: 4,
      description: 'A half-fraction (2^5-1) with 16 runs. Generator: E=ABCD. Resolution V – main effects and 2FIs all estimable.'
    };
  }

  if (k === 6 && preferSmall) {
    // 2^6-3 = 8 runs, generators D=AB, E=AC, F=BC, Resolution III
    const base = fullFactorial2k(3);
    const matrix = applyGenerators(3, base, [[0, 1], [0, 2], [1, 2]]);
    return {
      matrix,
      resolution: 'Resolution III',
      designType: '2^(6-3) Fractional Factorial',
      factorialRuns: 8,
      centerPoints: 4,
      description: 'An eighth-fraction (2^6-3) with 8 runs. Generators: D=AB, E=AC, F=BC. Resolution III – useful for initial screening.'
    };
  }

  if (k === 6) {
    // 2^6-2 = 16 runs, generators E=ABC, F=BCD, Resolution IV
    const base = fullFactorial2k(4);
    const matrix = applyGenerators(4, base, [[0, 1, 2], [1, 2, 3]]); // E=ABC, F=BCD
    return {
      matrix,
      resolution: 'Resolution IV',
      designType: '2^(6-2) Fractional Factorial',
      factorialRuns: 16,
      centerPoints: 4,
      description: 'A quarter-fraction (2^6-2) with 16 runs. Generators: E=ABC, F=BCD. Resolution IV – main effects clear of 2FIs.'
    };
  }

  if (k === 7 && preferSmall) {
    // 2^7-4 = 8 runs, Resolution III
    const base = fullFactorial2k(3);
    const matrix = applyGenerators(3, base, [[0, 1], [0, 2], [1, 2], [0, 1, 2]]);
    return {
      matrix,
      resolution: 'Resolution III',
      designType: '2^(7-4) Fractional Factorial',
      factorialRuns: 8,
      centerPoints: 4,
      description: 'A 1/16-fraction (2^7-4) with 8 runs. Generators: D=AB, E=AC, F=BC, G=ABC. Resolution III – screening only.'
    };
  }

  if (k === 7) {
    // 2^7-3 = 16 runs, generators E=ABC, F=ABD, G=ACD, Resolution IV
    const base = fullFactorial2k(4);
    const matrix = applyGenerators(4, base, [[0, 1, 2], [0, 1, 3], [0, 2, 3]]);
    return {
      matrix,
      resolution: 'Resolution IV',
      designType: '2^(7-3) Fractional Factorial',
      factorialRuns: 16,
      centerPoints: 4,
      description: 'An eighth-fraction (2^7-3) with 16 runs. Generators: E=ABC, F=ABD, G=ACD. Resolution IV.'
    };
  }

  // k >= 8: Use Plackett-Burman 20-run
  return plackettBurman(k);
}

/* ── Plackett-Burman Designs ─────────────────────────────── */
const PB12_BASE = [1, 1, -1, 1, 1, 1, -1, -1, -1, 1, -1];
const PB20_BASE = [1, 1, -1, -1, 1, 1, 1, 1, -1, 1, -1, 1, -1, -1, -1, -1, 1, 1, -1, 1];

function cyclicShift(arr) {
  return [arr[arr.length - 1], ...arr.slice(0, arr.length - 1)];
}

function plackettBurman(k) {
  let base, runs, maxFactors;

  if (k <= 11) {
    base = PB12_BASE;
    runs = 12;
    maxFactors = 11;
  } else {
    base = PB20_BASE;
    runs = 20;
    maxFactors = 19;
  }

  // Build full PB matrix
  const rows = [];
  let row = [...base];
  for (let i = 0; i < runs - 1; i++) {
    rows.push([...row].slice(0, k));
    row = cyclicShift(row);
  }
  rows.push(new Array(k).fill(-1)); // last row all -1

  return {
    matrix: rows,
    resolution: 'Resolution III (PB)',
    designType: `Plackett-Burman (${runs} runs)`,
    factorialRuns: runs,
    centerPoints: 4,
    description: `A Plackett-Burman design with ${runs} runs for up to ${maxFactors} factors. Highly efficient for screening – all main effects are estimable.`
  };
}

/* ── Central Composite Design (CCD) ─────────────────────── */
function centralComposite(k, facecentered = true) {
  const alpha = facecentered ? 1.0 : Math.pow(Math.pow(2, k), 0.25);

  // Factorial part (use half fraction for k >= 5)
  let factPart;
  if (k <= 4) {
    factPart = fullFactorial2k(k);
  } else {
    // half fraction
    const base = fullFactorial2k(k - 1);
    const lastGen = base.map(row => row.reduce((p, v) => p * v, 1));
    factPart = base.map((row, i) => [...row, lastGen[i]]);
  }

  const factRuns = factPart.map(row => ({ type: 'Factorial', coded: row }));

  // Axial points
  const axialRuns = [];
  for (let j = 0; j < k; j++) {
    const rowPos = new Array(k).fill(0); rowPos[j] = +alpha;
    const rowNeg = new Array(k).fill(0); rowNeg[j] = -alpha;
    axialRuns.push({ type: 'Axial', coded: rowPos });
    axialRuns.push({ type: 'Axial', coded: rowNeg });
  }

  // Center points
  const nc = k <= 3 ? 4 : k <= 5 ? 5 : 6;
  const centerRuns = Array.from({ length: nc }, () => ({
    type: 'Center',
    coded: new Array(k).fill(0)
  }));

  const allRuns = [...factRuns, ...axialRuns, ...centerRuns];

  return {
    matrix: allRuns.map(r => r.coded),
    runTypes: allRuns.map(r => r.type),
    resolution: 'RSM – Full Quadratic Model',
    designType: `Central Composite Design (CCD, α=${alpha.toFixed(2)})`,
    factorialRuns: factPart.length,
    axialRuns: 2 * k,
    centerPoints: nc,
    totalRuns: allRuns.length,
    alpha,
    description: `A ${facecentered ? 'face-centered' : 'rotatable'} CCD with ${factPart.length} factorial, ${2 * k} axial (α=${alpha.toFixed(2)}), and ${nc} center runs. Fits a full quadratic response surface model.`
  };
}

/* ── Recommend design based on factor count ──────────────── */
function recommendDesign(nFactors, phase) {
  if (phase === 'screening') {
    if (nFactors <= 3) return { key: 'FF_full', label: 'Full Factorial', ...fractionalFactorial(nFactors) };
    if (nFactors <= 5) return { key: 'FF_half', label: 'Fractional Factorial', ...fractionalFactorial(nFactors, false) };
    if (nFactors <= 7) return { key: 'FF_frac', label: 'Fractional Factorial', ...fractionalFactorial(nFactors, true) };
    return { key: 'PB', label: 'Plackett-Burman', ...plackettBurman(nFactors) };
  } else {
    // optimization phase – CCD
    return { key: 'CCD', label: 'Central Composite Design', ...centralComposite(nFactors) };
  }
}

/* ── Decode coded values to actual values ────────────────── */
function decodeValues(codedRow, factors) {
  return codedRow.map((coded, i) => {
    const f = factors[i];
    if (!f) return coded;
    // coded = (actual - baseline) / ((high - low) / 2)
    // actual = baseline + coded * (high - low) / 2
    const center = (f.high + f.low) / 2;
    const halfRange = (f.high - f.low) / 2;
    return parseFloat((center + coded * halfRange).toFixed(4));
  });
}

/* ── Build full experiment list ───────────────────────────── */
function buildExperiments(designResult, factors, ncenter = 4) {
  const { matrix, runTypes } = designResult;
  const experiments = [];

  for (let i = 0; i < matrix.length; i++) {
    const coded = matrix[i];
    const actual = decodeValues(coded, factors);
    const type = runTypes ? runTypes[i] : (coded.every(v => v === 0) ? 'Center' : 'Factorial');
    experiments.push({
      run_number: i + 1,
      run_type: type,
      coded_values: JSON.stringify(coded),
      actual_values: JSON.stringify(actual),
      result_values: null
    });
  }

  return experiments;
}

module.exports = {
  fullFactorial2k,
  fractionalFactorial,
  plackettBurman,
  centralComposite,
  recommendDesign,
  decodeValues,
  buildExperiments
};
