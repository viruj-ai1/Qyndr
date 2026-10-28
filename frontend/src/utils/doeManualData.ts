// ============================================================
// frontend/src/utils/doeManualData.ts
// Pharmaceutical DoE Selection Manual & QbD Strategy Reference Data
// Aligned with ICH Q8(R2), Q9(R1), and Q11 Guidelines
// ============================================================

export type DoECategory = 'Screening' | 'Optimization / RSM' | 'Formulation / Mixture' | 'Sequential / Adaptive'

export type ModelCapability =
  | 'Linear (Main Effects Only)'
  | 'Linear + 2FIs'
  | 'Full Quadratic (Curvature / Surface)'
  | 'Scheffé Polynomials'
  | 'Non-parametric GP'

export interface CaseStudy {
  title: string
  unitOperation: string
  compoundExample: string
  problemStatement: string
  inputFactors: string[]
  monitoredCQAs: string[]
  outcome: string
}

export interface DoEDesignManualEntry {
  id: string
  key: string // Backend key: PB, FF, TAGUCHI, DSD, CCD_FC, CCD_ROT, BBD, MIXTURE, D_OPTIMAL, BAYESIAN_GP
  name: string
  shortName: string
  category: DoECategory
  experimentObjective: string
  numberOfStages: string
  qtppLinkage: string
  cqaCapacity: string
  factorRange: string
  factorCountMin: number
  factorCountMax: number
  runCountFormula: string
  typicalRunExamples: string
  modelCapability: ModelCapability
  resolution: string
  pros: string[]
  cons: string[]
  ichGuidance: string
  caseStudy: CaseStudy
}

export const DOE_MANUAL_DESIGNS: DoEDesignManualEntry[] = [
  {
    id: 'pb',
    key: 'PB',
    name: 'Plackett-Burman Design (PB)',
    shortName: 'Plackett-Burman',
    category: 'Screening',
    experimentObjective: 'High-throughput initial factor screening to separate the vital few Critical Process Parameters (CPPs) from the trivial many non-critical variables with minimum experimental run investment.',
    numberOfStages: 'Single Unit Operation (e.g. Stage 1 Crude Synthesis, Milling, or Extraction)',
    qtppLinkage: 'Broad Compendial Profile (screening parameters impacting gross assay, dissolution rate, and primary degradation pathways)',
    cqaCapacity: '1 to 3 primary CQAs (e.g. Chemical Purity %, Impurity Profile, Isolated Yield %)',
    factorRange: '8 to 15+ Factors (most economical when investigating large parameter candidate pools)',
    factorCountMin: 8,
    factorCountMax: 20,
    runCountFormula: 'N = k + 1 rounded up to next multiple of 4 (e.g., N = 12, 16, 20, 24 runs)',
    typicalRunExamples: 'k=8: 12 runs | k=11: 12 runs | k=15: 16 runs',
    modelCapability: 'Linear (Main Effects Only)',
    resolution: 'Resolution III (Main effects confounded with 2-factor interactions)',
    pros: [
      'Maximum run efficiency for large factor candidate lists (e.g., 11 factors in only 12 runs)',
      'Orthogonal main effect estimates with zero covariance between linear terms',
      'Minimizes raw material, solvent, and active pharmaceutical ingredient (API) consumption',
      'Rapid cycle time during early discovery and route-scouting campaigns'
    ],
    cons: [
      'Severe aliasing: main effects are heavily confounded with two-factor interaction pairs',
      'Cannot estimate curvature or quadratic response surface topography',
      'Requires foldover runs if an interaction is suspected of masking a main effect'
    ],
    ichGuidance: 'ICH Q9(R1) Risk Management Step 2 (Preliminary Factor Triage prior to formal Design Space definition)',
    caseStudy: {
      title: 'Stage 1 API Alkylation Reaction Screening',
      unitOperation: 'Homogeneous Liquid Phase Alkylation',
      compoundExample: 'Propofol Intermediate / Heterocyclic Amide API',
      problemStatement: 'During route scouting, 11 potential variables were flagged by the Ishikawa Fishbone matrix as potential sources of unwanted dimer formation.',
      inputFactors: [
        'Reaction Temperature (40–80°C)',
        'Stirrer Speed (200–500 RPM)',
        'Catalyst Loading (0.5–2.5 mol%)',
        'Base Ratio (1.0–1.4 eq)',
        'Reagent Addition Time (15–60 min)',
        'Solvent Moisture (0.05–0.5% v/v)',
        'Solvent-to-Substrate Ratio (4–10 L/kg)',
        'Agitator Impeller Type (Pitched vs. Rushton)',
        'Inert Gas Flow (0.1–1.0 L/min)',
        'Quench Temperature (0–25°C)',
        'Aging Period (1–6 hours)'
      ],
      monitoredCQAs: ['Crude Yield (%)', 'Dimer Impurity A (%)', 'Residual Starting Material (%)'],
      outcome: 'A 12-run Plackett-Burman screen demonstrated that Catalyst Loading, Base Ratio, and Temperature accounted for 88% of impurity variability. The remaining 8 factors were confirmed non-critical and locked to standard operating setpoints.'
    }
  },
  {
    id: 'fractional_factorial',
    key: 'FF',
    name: 'Fractional Factorial Design (2^(k-p))',
    shortName: 'Fractional Factorial',
    category: 'Screening',
    experimentObjective: 'Balanced factor screening and two-factor interaction discovery; evaluates main effects and key synergistic/antagonistic interaction pairs with controlled aliasing.',
    numberOfStages: 'Single Unit Operation or Focused Sub-Process (e.g. Stage 2 Crystallization or Granulation)',
    qtppLinkage: 'Patient-Critical Safety & Purity Specifications (e.g. specific genotoxic impurities, polymorphic purity)',
    cqaCapacity: '2 to 5 Critical Quality Attributes (e.g. Yield, Assay, Related Impurities, Crystal Form)',
    factorRange: '4 to 8 Factors (balanced resolution and run economy)',
    factorCountMin: 4,
    factorCountMax: 8,
    runCountFormula: 'N = 2^(k-p) + C0 center points (Resolution IV: N = 16 runs for k=5; Resolution V: N = 32 runs for k=6)',
    typicalRunExamples: 'k=4: 8 runs (Res IV) | k=5: 16 runs (Res V) | k=6: 32 runs (Res V)',
    modelCapability: 'Linear + 2FIs',
    resolution: 'Resolution IV (Main clear of 2FIs; 2FIs aliased with 2FIs) or Resolution V (Main & 2FIs completely clear)',
    pros: [
      'Clear mathematical alias hierarchy based on defining generators',
      'Enables unbiased identification of 2-factor interaction mechanisms',
      'Can be augmented with center points to test for curvature and compute pure error degrees of freedom',
      'Extensively recognized and praised across FDA and EMA regulatory filing templates'
    ],
    cons: [
      'Resolution IV designs alias 2-factor interactions with other 2-factor interaction pairs',
      'Does not estimate pure quadratic / curvature coordinates across the factor space',
      'Requires power of 2 run numbers (8, 16, 32, 64) which may jump substantially between factor counts'
    ],
    ichGuidance: 'ICH Q8(R2) Section 2.4 (Multivariate Factor Interaction Investigation & Risk Reduction)',
    caseStudy: {
      title: 'Fluidized Bed Granulation Parameter Optimization',
      unitOperation: 'Top-Spray Fluid Bed Granulation & Drying',
      compoundExample: 'Immediate Release Metformin / Sitagliptin Tablets',
      problemStatement: 'Tablet dissolution failure occurred due to inconsistent granule porosity and broad particle size distribution.',
      inputFactors: [
        'Spray Rate (20–50 g/min)',
        'Atomization Air Pressure (1.0–2.5 bar)',
        'Inlet Air Temperature (50–75°C)',
        'Binder Solution Viscosity (10–35 cP)',
        'Fluidization Air Velocity (40–90 m³/h)'
      ],
      monitoredCQAs: ['Granule D50 (μm)', 'Carr Index (%)', 'Moisture Content Loss on Drying (%)', '15-min Dissolution (%)'],
      outcome: 'A 16-run Resolution V Fractional Factorial (2^(5-1)) identified a strong positive interaction between Spray Rate and Atomization Pressure governing granule friability, establishing initial Proven Acceptable Ranges (PAR).'
    }
  },
  {
    id: 'taguchi',
    key: 'TAGUCHI',
    name: 'Taguchi Orthogonal Arrays (L4, L8, L9, L12, L16, L18)',
    shortName: 'Taguchi Robust Design',
    category: 'Screening',
    experimentObjective: 'Robust Parameter Design (RPD) to identify factor setpoints that minimize process variance in the presence of uncontrollable environmental, operator, or raw material noise factors.',
    numberOfStages: 'Single Unit Operation with high raw material variability (e.g. Tablet Compression, Lyophilization)',
    qtppLinkage: 'Physical Drug Product Robustness & Uniformity (e.g. Content Uniformity USP <905>, Friability < 1.0%)',
    cqaCapacity: '1 to 3 CQAs analyzed via Signal-to-Noise (S/N) Ratio formulas (Nominal-the-Best, Larger-the-Better)',
    factorRange: '3 to 15 Factors across mixed 2-level and 3-level assignments',
    factorCountMin: 3,
    factorCountMax: 15,
    runCountFormula: 'Fixed standard matrix: L8 (8 runs), L9 (9 runs), L12 (12 runs), L16 (16 runs), L18 (18 runs)',
    typicalRunExamples: 'L8: 8 runs (up to 7 2-level factors) | L9: 9 runs (up to 4 3-level factors) | L18: 18 runs (mixed levels)',
    modelCapability: 'Linear (Main Effects Only)',
    resolution: 'Resolution III (Main effects separated from noise variance via S/N transformation)',
    pros: [
      'Focuses directly on quality loss functions and variance minimization rather than just mean response',
      'Supports mixed 2-level and 3-level categorical and continuous factors in a single matrix (e.g., L18)',
      'Extremely effective for manufacturing scale robustness testing and transfer to commercial plants'
    ],
    cons: [
      'Interactions are assumed negligible; severe confounding can occur if strong cross-terms exist',
      'Less flexible than response surface designs for non-linear multidimensional contour mapping'
    ],
    ichGuidance: 'ICH Q8(R2) Section 2.5 (Control Strategy Development & Process Robustness Verification)',
    caseStudy: {
      title: 'High-Speed Rotary Tablet Press Robustness Optimization',
      unitOperation: 'Rotary Tablet Compression',
      compoundExample: 'Direct Compression API Blend / Extended Release Core',
      problemStatement: 'High tablet weight and hardness variability occurred when commercial raw material excipient lots varied in particle shape and bulk density.',
      inputFactors: [
        'Pre-compression Force (2–6 kN)',
        'Main Compression Force (10–25 kN)',
        'Turret Speed (20–60 RPM)',
        'Feeder Paddle Speed (15–45 RPM)',
        'Feed Frame Clearance (0.05–0.25 mm)'
      ],
      monitoredCQAs: ['Tablet Hardness (kP)', 'Weight RSD (%)', 'Friability (%)', 'Ejection Force (N)'],
      outcome: 'An L18 Taguchi design subjected to raw material bulk density noise identified a sweet spot setpoint for Main Compression Force and Paddle Speed that reduced tablet hardness RSD from 8.4% to 2.1%.'
    }
  },
  {
    id: 'dsd',
    key: 'DSD',
    name: 'Definitive Screening Design (DSD)',
    shortName: 'Definitive Screening (DSD)',
    category: 'Screening',
    experimentObjective: 'Modern 3-level screening design that estimates all main effects completely unconfounded with any 2-factor interactions, while simultaneously identifying non-linear curvature without requiring an expensive RSM design.',
    numberOfStages: 'Single Unit Operation or Multi-Stage Interface (e.g. Synthesis + In-situ Quench)',
    qtppLinkage: 'Comprehensive Intermediate Purity & Process Yield Targets (e.g. ICH Q3A Impurity Thresholds)',
    cqaCapacity: '3 to 6 Critical Quality Attributes (e.g. Conversion %, Regioisomer Ratio, Residual Solvents)',
    factorRange: '4 to 12 Factors (ideal when k >= 5)',
    factorCountMin: 4,
    factorCountMax: 12,
    runCountFormula: 'N = 2k + 1 (plus 2–3 center runs recommended: N = 2k + 3, e.g. 6 factors = 15 runs)',
    typicalRunExamples: 'k=4: 9 runs | k=6: 13 runs | k=8: 17 runs | k=10: 21 runs',
    modelCapability: 'Linear + 2FIs',
    resolution: 'Curvature-Capable (Main effects orthogonal to all 2FIs; 2FIs not fully aliased with each other)',
    pros: [
      'Unsurpassed run economy: scales linearly (2k+1) rather than exponentially (2^k)',
      'Main effects are orthogonal to all two-factor interactions AND all quadratic terms',
      'Includes 3 levels per factor (-1, 0, +1), enabling direct detection of quadratic curvature',
      'If only 2–3 factors are active, can be collapsed directly into a full Response Surface Model'
    ],
    cons: [
      'When more than 3 factors exhibit strong two-factor interactions, partial confounding requires augment runs',
      'Cannot estimate all two-factor interactions simultaneously without model selection / backward elimination'
    ],
    ichGuidance: 'ICH Q8(R2) & ICH Q11 (Efficient Risk-Based Process Development for Drug Substances)',
    caseStudy: {
      title: 'Continuous Flow API Synthesis Microreactor Optimization',
      unitOperation: 'Continuous Microfluidic Addition & Quench',
      compoundExample: 'Fosravuconazole / Kinase Inhibitor Intermediate',
      problemStatement: 'Rapid exothermic reaction suffered from local hotspots, resulting in regioisomeric degradation in batch reactors.',
      inputFactors: [
        'Residence Time (0.5–4.0 min)',
        'Microreactor Temperature (60–120°C)',
        'Reagent Molar Ratio (1.05–1.40 eq)',
        'System Backpressure (3–10 bar)',
        'Solvent Flow Rate Ratio (0.2–0.8 v/v)',
        'Catalyst Concentration (0.1–0.8 M)'
      ],
      monitoredCQAs: ['Overall Conversion (%)', 'Regioisomer Ratio (Target/Impurity)', 'Byproduct B (ppm)'],
      outcome: 'A 15-run DSD identified strong non-linear curvature in Temperature and a synergistic interaction between Residence Time and Catalyst concentration, achieving 99.4% conversion and saving over 40 experimental runs compared to classical CCD.'
    }
  },
  {
    id: 'full_factorial',
    key: 'FF',
    name: 'Full Factorial Design (2^k, 3^k)',
    shortName: 'Full Factorial',
    category: 'Optimization / RSM',
    experimentObjective: 'Exhaustive characterization of all parameter combinations, main effects, and all higher-order interactions (2-way, 3-way, up to k-way) with zero aliasing.',
    numberOfStages: 'Critical Unit Operation / Regulatory Filing Milestone (e.g. Salt Formation or Sterile Filtration)',
    qtppLinkage: 'Critical Patient Safety Specifications with high regulatory scrutiny (Sterility Assurance, Enantiomer Excess)',
    cqaCapacity: '1 to 6 CQAs evaluated simultaneously across all multi-factor permutations',
    factorRange: '2 to 4 Factors (strictly limited due to exponential run count scaling)',
    factorCountMin: 2,
    factorCountMax: 4,
    runCountFormula: 'N = 2^k + C0 center points (or 3^k for 3-level designs, e.g. 2^3 + 3 = 11 runs; 2^4 + 4 = 20 runs)',
    typicalRunExamples: 'k=2: 4-7 runs | k=3: 8-11 runs | k=4: 16-20 runs',
    modelCapability: 'Linear + 2FIs',
    resolution: 'Full Resolution (Completely unaliased; estimates all terms through k-factor interactions)',
    pros: [
      'Complete mathematical transparency: zero confounding between any main effects or interactions',
      'Maximum statistical power and degrees of freedom for residual variance estimation',
      'Enables exact mechanistic modeling of complex physical-chemical phenomena'
    ],
    cons: [
      'Exponential run count explosion: 5 factors require 32 runs, 6 factors require 64 runs',
      'Excessive resource consumption when screening exploratory variables'
    ],
    ichGuidance: 'ICH Q8(R2) Section 2.4.1 (Comprehensive Multi-Factor Interaction Modeling for Critical Unit Operations)',
    caseStudy: {
      title: 'API Chiral Salt Crystallization & Enantiomeric Purification',
      unitOperation: 'Cooling & Antisolvent Crystallization',
      compoundExample: 'Chiral CNS Agent API / Tartrate Salt Formation',
      problemStatement: 'Severe chiral inversion and low crystallization yield occurred if cooling and seeding profiles were misaligned.',
      inputFactors: [
        'Chiral Resolving Agent Molar Ratio (0.95–1.15 eq)',
        'Crystallization Seeding Temperature (45–65°C)',
        'Cooling Rate (0.1–0.8 °C/min)'
      ],
      monitoredCQAs: ['Chiral Purity (% ee)', 'Crystalline Yield (%)', 'Aspect Ratio (Length/Width)'],
      outcome: 'An 11-run 2^3 full factorial with 3 center points revealed a critical 3-way interaction between resolving agent molar ratio, seeding temp, and cooling rate, establishing the definitive commercial crystallization operating envelope.'
    }
  },
  {
    id: 'bbd',
    key: 'BBD',
    name: 'Box-Behnken Design (BBD)',
    shortName: 'Box-Behnken (RSM)',
    category: 'Optimization / RSM',
    experimentObjective: 'Response Surface Methodology (RSM) optimization to model quadratic curvature and multi-dimensional sweet spots, while strictly avoiding extreme corner/axial factor combinations.',
    numberOfStages: 'Single Unit Operation with physical/safety bounds (e.g. Exothermic Hydrogenation, Spray Drying)',
    qtppLinkage: 'Formal Commercial Design Space & Critical Quality Attributes sensitive to thermal/shear degradation',
    cqaCapacity: '3 to 8 CQAs optimized simultaneously using Derringer-Suich Multi-Response Desirability Functions',
    factorRange: '3 to 7 Factors (ideally 3 to 5 factors for maximum efficiency)',
    factorCountMin: 3,
    factorCountMax: 7,
    runCountFormula: 'N = 2k(k-1) + C0 center points (e.g., k=3 -> 15 runs; k=4 -> 27 runs; k=5 -> 46 runs)',
    typicalRunExamples: 'k=3: 15 runs (3 center pts) | k=4: 27 runs (3 center pts) | k=5: 46 runs (6 center pts)',
    modelCapability: 'Full Quadratic (Curvature / Surface)',
    resolution: 'RSM Quadratic (Estimates Intercept, Linear Main Effects, 2FIs, and pure Quadratic Curvature terms)',
    pros: [
      'Eliminates dangerous or physically impossible corner runs (all points lie on edges or center)',
      'Requires fewer runs than Central Composite Design for k = 3 (15 runs vs. 20 runs)',
      'Spherical design geometry provides high prediction consistency near the center point',
      'Directly generates interactive 2D contour sweet spots and 3D response surfaces'
    ],
    cons: [
      'Cannot be applied to 2-factor studies (requires at least 3 factors)',
      'Not suitable if the physical process optimum is expected to lie at an extreme vertex or corner'
    ],
    ichGuidance: 'ICH Q8(R2) Section 2.4.2 (Formal Multi-Dimensional Design Space Construction & Proven Acceptable Range [PAR] Verification)',
    caseStudy: {
      title: 'High-Shear Wet Granulation & Fluid Bed Drying Optimization',
      unitOperation: 'High-Shear Wet Granulation',
      compoundExample: 'Solid Oral Dosage Form / BCS Class II Poorly Soluble API',
      problemStatement: 'High impeller speeds combined with high water addition caused overwetting, mass hardening, and motor stall.',
      inputFactors: [
        'Impeller Speed (150–350 RPM)',
        'Chopper Speed (1000–2500 RPM)',
        'Liquid Addition Rate (50–150 mL/min)',
        'Total Water Amount (15–28% w/w)'
      ],
      monitoredCQAs: ['Granule Density (g/mL)', 'Tablet Tensile Strength (MPa)', 'Disintegration Time (sec)', 'Dissolution at 30 min (%)'],
      outcome: 'A 27-run Box-Behnken design mapped the non-linear curvature without triggering any motor stalls, identifying a robust multi-criteria sweet spot with overall desirability D = 0.94.'
    }
  },
  {
    id: 'ccd',
    key: 'CCD_FC',
    name: 'Central Composite Design (CCD: Face-Centered & Rotatable)',
    shortName: 'Central Composite (CCD)',
    category: 'Optimization / RSM',
    experimentObjective: 'Industry gold-standard Response Surface Design for building robust second-order quadratic models and establishing regulatory Design Spaces; can be built sequentially by augmenting 2^k screening factorial runs.',
    numberOfStages: 'Final API Stage Optimization & Commercial Process Validation (e.g. API Isolation, Chromatography)',
    qtppLinkage: 'Regulatory Submission Dossier Targets (Assay 98.0–102.0%, Genotoxic Impurities < TTC, Residual Solvents)',
    cqaCapacity: '3 to 10 CQAs evaluated across multi-criteria contour overlays',
    factorRange: '2 to 6 Factors (sequential augmentation from 2-level designs)',
    factorCountMin: 2,
    factorCountMax: 6,
    runCountFormula: 'N = 2^k + 2k + C0 center runs (e.g. k=3 -> 20 runs; k=4 -> 30 runs; k=5 -> 52 runs)',
    typicalRunExamples: 'k=2: 13 runs | k=3: 20 runs (6 center pts) | k=4: 30 runs (6 center pts) | k=5: 52 runs',
    modelCapability: 'Full Quadratic (Curvature / Surface)',
    resolution: 'RSM Quadratic (Ideal prediction variance profile across entire experimental domain)',
    pros: [
      'Sequential flexibility: start with 2^k factorial, test center curvature, and add axial star runs only if necessary',
      'Face-Centered variant (alpha=1.0) keeps all runs strictly within existing physical operating boundaries (3 levels)',
      'Rotatable variant provides equal prediction variance at all points equidistant from the center',
      'Highest precision for locating true multi-response global stationary points'
    ],
    cons: [
      'Rotatable variant requires 5 levels per factor (-alpha, -1, 0, +1, +alpha), which may be difficult for precise equipment',
      'Run count scales quickly for 5 or more factors (e.g., 52 runs for k=5)'
    ],
    ichGuidance: 'ICH Q8(R2) Section 2.4.2 & Section 3 (Formal Regulatory Submission of Proven Acceptable Ranges [PAR] & Design Space Envelope)',
    caseStudy: {
      title: 'Biopharmaceutical Lyophilization Cycle Design Space',
      unitOperation: 'Freeze Drying / Lyophilization',
      compoundExample: 'Monoclonal Antibody (mAb) Lyophilized Cake',
      problemStatement: 'Cake collapse and high residual moisture occurred when primary drying shelf temperature and chamber pressure were operated outside optimal sublimation limits.',
      inputFactors: [
        'Freezing Shelf Temperature (-50 to -35°C)',
        'Primary Drying Shelf Temperature (-20 to +10°C)',
        'Chamber Vacuum Pressure (50–200 mTorr)'
      ],
      monitoredCQAs: ['Residual Moisture by Karl Fischer (%)', 'Cake Reconstitution Time (sec)', 'Monomer Purity by SEC-HPLC (%)', 'Glass Transition Temp Tg (C)'],
      outcome: 'A 20-run Face-Centered CCD mapped the sublimation rate boundary, establishing a validated 3D Design Space approved by health authorities with normal operating ranges (NOR) established within the envelope.'
    }
  },
  {
    id: 'mixture',
    key: 'MIXTURE',
    name: 'Simplex Lattice & Simplex Centroid (Mixture Design)',
    shortName: 'Simplex Mixture Design',
    category: 'Formulation / Mixture',
    experimentObjective: 'Formulation, co-solvent, and excipient ratio optimization where components are dependent and must sum to a constant total (e.g., sum of xi = 100% or 1.0).',
    numberOfStages: 'Drug Product Formulation & Vehicle Composition (e.g. Lipid Nanoparticles, Emulsions, Oral Liquids)',
    qtppLinkage: 'Bioavailability, In-vitro Dissolution Rate (>85% in 15 min), Syringeability, Encapsulation Efficiency (>90%)',
    cqaCapacity: '2 to 6 Formulation CQAs evaluated via ternary response surfaces',
    factorRange: '3 to 6 Mixture Components (q = 3 to 6 components)',
    factorCountMin: 3,
    factorCountMax: 6,
    runCountFormula: 'Simplex Centroid: N = 2^q - 1 + C0 replicates (e.g., q=3 -> 7 blend runs + 3 replicates = 10 runs; q=4 -> 15 runs)',
    typicalRunExamples: 'q=3: 10 runs (with replicates) | q=4: 15-18 runs | q=5: 31-36 runs',
    modelCapability: 'Scheffé Polynomials',
    resolution: 'Mixture Surface (Pure components, binary blends, ternary blends, and overall centroid)',
    pros: [
      'Directly handles component dependencies where factors cannot change independently without violating 100% total',
      'Estimates synergistic and antagonistic blending effects using Scheffé polynomials',
      'Generates interactive ternary contour diagrams that clearly reveal excipient compatibility regions'
    ],
    cons: [
      'Cannot use standard Cartesian independent-variable regression models',
      'Constrained to simplex geometry; lower and upper component constraints require specialized pseudo-component transforms'
    ],
    ichGuidance: 'ICH Q8(R2) Section 2.2.1 (Formulation Development, Excipient Compatibility, & Delivery Vehicle Optimization)',
    caseStudy: {
      title: 'mRNA Lipid Nanoparticle (LNP) Delivery Vehicle Formulation',
      unitOperation: 'Microfluidic Hydrodynamic Flow Focusing',
      compoundExample: 'mRNA-LNP Vaccine / Therapeutic Formulation',
      problemStatement: 'Suboptimal encapsulation efficiency and high polydispersity occurred when lipid component molar fractions deviated from ideal self-assembly ratios.',
      inputFactors: [
        'Ionizable Cationic Lipid (35–55 mol%)',
        'Phospholipid Helper DSPC (5–20 mol%)',
        'Cholesterol (30–45 mol%)',
        'PEGylated Lipid (0.5–3.0 mol%)'
      ],
      monitoredCQAs: ['Encapsulation Efficiency (%)', 'Particle Size Z-Average (nm)', 'Polydispersity Index (PDI)', 'In-vitro Transfection (RLU)'],
      outcome: 'A 15-run Simplex Centroid mixture design revealed a critical synergistic ratio between Ionizable Lipid and Cholesterol that achieved 97.2% encapsulation efficiency with PDI < 0.08.'
    }
  },
  {
    id: 'd_optimal',
    key: 'D_OPTIMAL',
    name: 'D-Optimal & I-Optimal (Algorithmic / Constrained Design)',
    shortName: 'D-Optimal / Custom',
    category: 'Optimization / RSM',
    experimentObjective: 'Computer-generated custom design that maximizes the information matrix determinant (|X^T X|) or minimizes average prediction variance across an irregular, non-cuboidal, or physically constrained experimental domain.',
    numberOfStages: 'Complex Process Route with Thermodynamic, Hazard, or Operational Constraints (e.g. Flash points, Boiling limits)',
    qtppLinkage: 'Critical Process Safety Margins and Yield envelopes where specific parameter combinations are physically forbidden',
    cqaCapacity: '2 to 8 CQAs evaluated within non-rectangular irregular design boundaries',
    factorRange: '2 to 10 Factors (supports mixed continuous and multi-level categorical parameters)',
    factorCountMin: 2,
    factorCountMax: 10,
    runCountFormula: 'Custom user-specified run budget N >= p (minimum model parameters p + pure error replicates, e.g. 16–25 runs)',
    typicalRunExamples: 'k=3 (constrained): 16 runs | k=4 (with exclusions): 22 runs | k=5: 28 runs',
    modelCapability: 'Full Quadratic (Curvature / Surface)',
    resolution: 'Custom Optimized (Maximizes determinant of information matrix |X^T X| or minimizes prediction variance)',
    pros: [
      'Accommodates arbitrary exclusion zones (e.g., Temperature > 80°C forbidden when Solvent B > 40%)',
      'Fits exact physical budget constraints (e.g. exactly 18 runs available on automated parallel synthesizer)',
      'Seamlessly blends continuous variables with multi-level categorical factors (e.g. 3 catalyst types, 2 impeller geometries)'
    ],
    cons: [
      'Requires algorithmic optimization (Coordinate Exchange algorithm); design points are less intuitive than classical patterns',
      'Lacks the clean orthogonal symmetry of standard Box-Behnken or Fractional designs'
    ],
    ichGuidance: 'ICH Q8(R2) Section 2.4.3 (Design Space Boundaries with Physical, Kinetic, or Toxicological Operating Constraints)',
    caseStudy: {
      title: 'API Grignard Reagent Synthesis with Severe Thermal Safety Constraints',
      unitOperation: 'Exothermic Organometallic Addition & Quench',
      compoundExample: 'Active Pharmaceutical Ingredient Key Intermediate',
      problemStatement: 'Reaction mixtures above 65°C combined with reagent concentration > 2.0 M triggered dangerous thermal runaways in safety calorimeter studies.',
      inputFactors: [
        'Jacket Temperature (30–75°C)',
        'Grignard Feed Rate (2–12 mL/min)',
        'Substrate Concentration (0.8–2.5 M)',
        'Solvent Type (THF vs. 2-MeTHF vs. CPME [Categorical])'
      ],
      monitoredCQAs: ['Reaction Yield (%)', 'Thermal Onset Margin Delta T (°C)', 'Des-bromo Byproduct (%)'],
      outcome: 'A 22-run D-Optimal design incorporating a strict triangular safety exclusion zone mapped the safe operational envelope, enabling 94% yield while maintaining a minimum 35°C thermal safety margin.'
    }
  },
  {
    id: 'bayesian_gp',
    key: 'BAYESIAN_GP',
    name: 'Bayesian Adaptive Sequential Optimization (Gaussian Process)',
    shortName: 'Bayesian Optimization (GP)',
    category: 'Sequential / Adaptive',
    experimentObjective: 'Active learning sequential experimental campaign that utilizes Gaussian Process regression and Bayesian Acquisition Functions (Expected Improvement / UCB) to locate global optima in minimum physical runs.',
    numberOfStages: 'High-Cost / Severe Material-Constrained Campaigns (e.g. Peptide Solid Phase Synthesis, Rare Biocatalysts)',
    qtppLinkage: 'High-Value Efficacy Specifications where raw material or reagent consumption is severely restricted',
    cqaCapacity: '1 to 4 CQAs with multi-objective hypervolume Pareto frontier exploration',
    factorRange: '2 to 8 Continuous Factors',
    factorCountMin: 2,
    factorCountMax: 8,
    runCountFormula: 'N_initial = 5 to 10 exploratory runs, followed by 1 to 2 adaptive runs per iteration until convergence',
    typicalRunExamples: 'Initial batch: 6 runs | Adaptive iterations: 6–10 single runs | Total: 12–16 runs',
    modelCapability: 'Non-parametric GP',
    resolution: 'Adaptive Sequential (Iterative uncertainty reduction along the Pareto frontier with 95% Confidence Bounds)',
    pros: [
      'Minimizes overall physical experiment consumption by targeting high-information coordinates',
      'Naturally models non-linear, multi-modal, and rugged response landscapes without polynomial bias',
      'Provides probabilistic predictions with explicit 95% confidence intervals and uncertainty maps'
    ],
    cons: [
      'Requires sequential experiment execution (cannot run all experiments simultaneously in a single parallel batch)',
      'Requires active re-training of the Gaussian Process surrogate model after every observed run'
    ],
    ichGuidance: 'ICH Q8(R2) & ICH Q9 (Iterative Knowledge Acquisition, Active Learning, & Continuous Process Verification)',
    caseStudy: {
      title: 'Enzymatic Biocatalysis Route Optimization for Chiral Amine Intermediate',
      unitOperation: 'Stereoselective Transaminase Biocatalysis',
      compoundExample: 'Sitagliptin Precursor / Chiral Amine Intermediate',
      problemStatement: 'Engineered transaminase enzyme was prohibitively expensive ($8,000/g); traditional RSM requiring 30+ runs was cost-prohibitive.',
      inputFactors: [
        'Enzyme Loading (0.2–1.5 wt%)',
        'Co-Factor PLP Concentration (0.1–1.0 mM)',
        'Isopropylamine Donor Equiv (1.5–5.0 eq)',
        'Temperature (35–55°C)',
        'DMSO Co-Solvent (5–20% v/v)'
      ],
      monitoredCQAs: ['Enantiomeric Excess ee (%)', 'Volumetric Productivity (g/L/day)', 'Enzyme Residual Activity (%)'],
      outcome: 'Starting with a 6-run Sobol sequence, Bayesian optimization converged to the global optimum (99.8% ee, 42 g/L/day) in only 8 sequential iterations, reducing enzyme consumption by 72% compared to standard CCD.'
    }
  }
]

// ============================================================
// Decision Wizard Engine
// ============================================================

export interface WizardAnswers {
  primaryGoal: 'screening' | 'optimization' | 'mixture' | 'constrained' | 'sequential'
  factorCount: 'few' | 'moderate' | 'many' // few: 2-4, moderate: 5-8, many: 9+
  cqaCount: 'low' | 'medium' | 'high' // low: 1-2, medium: 3-5, high: 6+
  stageScope: 'single' | 'multi'
}

export interface RecommendationResult {
  design: DoEDesignManualEntry
  matchScore: number
  reasons: string[]
  recommendedPhase: 'screening' | 'optimization'
}

export function recommendDoEFromWizard(answers: WizardAnswers): RecommendationResult[] {
  const scored = DOE_MANUAL_DESIGNS.map(design => {
    let score = 50
    const reasons: string[] = []

    // 1. Goal alignment
    if (answers.primaryGoal === 'screening') {
      if (design.category === 'Screening') {
        score += 35
        reasons.push('Specifically engineered for factor screening and identifying Critical Process Parameters (CPPs).')
      } else {
        score -= 25
      }
    } else if (answers.primaryGoal === 'optimization') {
      if (design.category === 'Optimization / RSM') {
        score += 35
        reasons.push('Provides quadratic response surface modeling and multi-dimensional Design Space mapping.')
      } else {
        score -= 20
      }
    } else if (answers.primaryGoal === 'mixture') {
      if (design.category === 'Formulation / Mixture') {
        score += 50
        reasons.push('Directly models dependent excipient or co-solvent ratios that must sum to a constant 100%.')
      } else {
        score -= 40
      }
    } else if (answers.primaryGoal === 'constrained') {
      if (design.id === 'd_optimal') {
        score += 45
        reasons.push('Excels at irregular operating boundaries, safety exclusion zones, and custom run budgets.')
      } else if (design.id === 'bbd') {
        score += 20
        reasons.push('Avoids extreme corner runs, which prevents dangerous physical factor combinations.')
      }
    } else if (answers.primaryGoal === 'sequential') {
      if (design.id === 'bayesian_gp') {
        score += 50
        reasons.push('Sequential active learning maximizes optimization efficiency with minimal material consumption.')
      } else if (design.id === 'ccd') {
        score += 20
        reasons.push('Can be executed sequentially (2^k factorial core followed by axial star points).')
      }
    }

    // 2. Factor Count alignment
    if (answers.factorCount === 'many') { // 9+
      if (design.id === 'pb') {
        score += 30
        reasons.push('Highly economical run scaling for large factor candidate lists (8 to 15+ factors).')
      } else if (design.id === 'dsd') {
        score += 25
        reasons.push('Linear scaling (2k+1) makes 9+ factor screening practical without 2FI confounding.')
      } else if (design.id === 'taguchi') {
        score += 20
        reasons.push('Standard L-arrays easily accommodate up to 15 factors.')
      } else if (design.factorCountMax < 8) {
        score -= 30
      }
    } else if (answers.factorCount === 'moderate') { // 5-8
      if (design.id === 'dsd') {
        score += 25
        reasons.push('Ideal sweet spot for Definitive Screening Design (k=5 to 8).')
      } else if (design.id === 'fractional_factorial') {
        score += 20
        reasons.push('Resolution IV/V Fractional Factorial offers balanced run economy.')
      } else if (design.id === 'bbd' && answers.primaryGoal === 'optimization') {
        score += 25
        reasons.push('Box-Behnken accommodates 5 factors with spherical efficiency.')
      }
    } else if (answers.factorCount === 'few') { // 2-4
      if (design.id === 'full_factorial') {
        score += 20
        reasons.push('Full Factorial is completely unconfounded and affordable at 2–3 factors.')
      } else if (design.id === 'ccd' && answers.primaryGoal === 'optimization') {
        score += 25
        reasons.push('Central Composite Design provides gold-standard response surface precision for 2–4 factors.')
      } else if (design.id === 'bbd' && answers.primaryGoal === 'optimization') {
        score += 20
        reasons.push('Box-Behnken delivers excellent quadratic modeling for 3–4 factors.')
      }
    }

    // 3. CQA Count alignment
    if (answers.cqaCount === 'high') { // 6+
      if (design.category === 'Optimization / RSM') {
        score += 15
        reasons.push('Full quadratic response surface models support simultaneous desirability multi-response trade-offs.')
      }
    }

    // 4. Stage Scope
    if (answers.stageScope === 'multi') {
      if (design.id === 'dsd' || design.id === 'd_optimal') {
        score += 10
        reasons.push('High parameter efficiency allows incorporating cross-stage transfer parameters.')
      }
    }

    // Recommended phase
    const recommendedPhase: 'screening' | 'optimization' =
      design.category === 'Screening' ? 'screening' : 'optimization'

    return {
      design,
      matchScore: Math.min(Math.max(score, 10), 99),
      reasons: reasons.slice(0, 3),
      recommendedPhase
    }
  })

  scored.sort((a, b) => b.matchScore - a.matchScore)
  return scored
}

// ============================================================
// 3-Question Minimal Stepper Engine (Option 1)
// ============================================================

export interface StepperAnswers {
  objective: 'screening' | 'optimization' | 'mixture'
  factorCount: 'few' | 'moderate' | 'many' // few: 2-4, moderate: 5-8, many: 9+
  priority: 'fast' | 'rigorous' // fast: Fast & Economical, rigorous: High Rigor & RSM
}

export interface StepperAlternative {
  key: string
  id: string
  name: string
  shortName: string
  category: DoECategory
  runBadge: string
  hint: string
}

export interface StepperRecommendation {
  design: DoEDesignManualEntry
  matchScore: number
  runBadge: string
  capabilityBadge: string
  whyFitsBullets: string[]
  recommendedPhase: 'screening' | 'optimization'
  alternative?: StepperAlternative
}

export function getStepperRecommendation(answers: StepperAnswers): StepperRecommendation {
  const findDesign = (id: string) =>
    DOE_MANUAL_DESIGNS.find(d => d.id === id) || DOE_MANUAL_DESIGNS[0]

  const { objective, factorCount, priority } = answers

  if (objective === 'screening') {
    if (factorCount === 'few') {
      if (priority === 'fast') {
        const d = findDesign('fractional_factorial')
        const alt = findDesign('dsd')
        return {
          design: d,
          matchScore: 95,
          runBadge: 'Total: 4 to 8 Runs',
          capabilityBadge: 'Linear Main Effects + 2-Factor Interactions',
          recommendedPhase: 'screening',
          whyFitsBullets: [
            'Directly isolates active parameter drivers with minimal run commitment.',
            'Unbiased main effect estimation without unnecessary center point runs.',
            'Fastest turnaround time for small candidate pools (2 to 4 factors).'
          ],
          alternative: {
            id: alt.id,
            key: alt.key,
            name: alt.name,
            shortName: alt.shortName,
            category: alt.category,
            runBadge: '9 to 13 Runs',
            hint: 'Definitive Screening if you also want early curvature detection'
          }
        }
      } else {
        const d = findDesign('dsd')
        const alt = findDesign('full_factorial')
        return {
          design: d,
          matchScore: 98,
          runBadge: 'Total: 9 to 13 Runs',
          capabilityBadge: '3-Level Orthogonal Screening + Curvature Check',
          recommendedPhase: 'screening',
          whyFitsBullets: [
            'Main effects are completely unconfounded with two-factor interactions.',
            'Evaluates 3 parameter levels to detect non-linear response curvature early.',
            'High statistical power (>85%) to identify true Critical Process Parameters.'
          ],
          alternative: {
            id: alt.id,
            key: alt.key,
            name: alt.name,
            shortName: alt.shortName,
            category: alt.category,
            runBadge: '8 to 16 Runs',
            hint: 'Full Factorial for exhaustive interaction mapping across all levels'
          }
        }
      }
    } else if (factorCount === 'moderate') {
      if (priority === 'fast') {
        const d = findDesign('dsd')
        const alt = findDesign('fractional_factorial')
        return {
          design: d,
          matchScore: 97,
          runBadge: 'Total: 13 to 17 Runs',
          capabilityBadge: '3-Level Orthogonal Screening (No 2FI Aliasing)',
          recommendedPhase: 'screening',
          whyFitsBullets: [
            'Linear run scaling (only 2k + 1 runs) avoids exponential run inflation for 5 to 8 factors.',
            'Zero confounding between main effects and two-factor interactions.',
            'Conserves raw material and active pharmaceutical ingredient (API).'
          ],
          alternative: {
            id: alt.id,
            key: alt.key,
            name: alt.name,
            shortName: alt.shortName,
            category: alt.category,
            runBadge: '16 Runs',
            hint: 'Fractional Factorial (Resolution IV) for classic 2-level grid'
          }
        }
      } else {
        const d = findDesign('dsd')
        const alt = findDesign('fractional_factorial')
        return {
          design: d,
          matchScore: 99,
          runBadge: 'Total: 15 to 21 Runs (with center points)',
          capabilityBadge: 'High-Power Orthogonal Screening + Curvature',
          recommendedPhase: 'screening',
          whyFitsBullets: [
            'Tests 3 levels per factor to identify curvature without committing to a full RSM.',
            'Center runs establish baseline process repeatability and lack-of-fit testing.',
            'Provides a seamless regulatory bridge into ICH Q8(R2) Design Space establishment.'
          ],
          alternative: {
            id: alt.id,
            key: alt.key,
            name: alt.name,
            shortName: alt.shortName,
            category: alt.category,
            runBadge: '32 Runs',
            hint: 'Resolution V Factorial for unaliased 2-factor interaction modeling'
          }
        }
      }
    } else {
      // 9+ factors
      if (priority === 'fast') {
        const d = findDesign('pb')
        const alt = findDesign('dsd')
        return {
          design: d,
          matchScore: 96,
          runBadge: 'Total: 12 to 16 Runs',
          capabilityBadge: 'High-Throughput Factor Elimination',
          recommendedPhase: 'screening',
          whyFitsBullets: [
            'Maximum run efficiency: screens up to 11 factors in only 12 runs, or 15 in 16 runs.',
            'Rapidly separates the vital few CPPs from trivial non-critical variables.',
            'Minimizes raw material, solvent, and active drug consumption during early scouting.'
          ],
          alternative: {
            id: alt.id,
            key: alt.key,
            name: alt.name,
            shortName: alt.shortName,
            category: alt.category,
            runBadge: '21+ Runs',
            hint: 'Definitive Screening if interaction confounding must be eliminated'
          }
        }
      } else {
        const d = findDesign('dsd')
        const alt = findDesign('pb')
        return {
          design: d,
          matchScore: 98,
          runBadge: 'Total: 21 to 27 Runs',
          capabilityBadge: 'Unconfounded 3-Level High-Dimensional Screening',
          recommendedPhase: 'screening',
          whyFitsBullets: [
            'Screens 9 to 12 parameters without confounding main effects with 2-factor interactions.',
            'Evaluates non-linear curvature across all parameters simultaneously.',
            'Saves over 50% experimental runs compared to classic Resolution IV factorials.'
          ],
          alternative: {
            id: alt.id,
            key: alt.key,
            name: alt.name,
            shortName: alt.shortName,
            category: alt.category,
            runBadge: '16 Runs',
            hint: 'Plackett-Burman if raw material budget is strictly limited'
          }
        }
      }
    }
  } else if (objective === 'optimization') {
    if (factorCount === 'few') {
      if (priority === 'fast') {
        const d = findDesign('bbd')
        const alt = findDesign('ccd')
        return {
          design: d,
          matchScore: 97,
          runBadge: 'Total: 13 to 17 Runs',
          capabilityBadge: 'Full Quadratic Surface (Spherical)',
          recommendedPhase: 'optimization',
          whyFitsBullets: [
            'Avoids extreme corner points where simultaneous parameter extremes could degrade API.',
            'Accurately maps non-linear response curvature with minimal run investment.',
            'Ideal for defining Proven Acceptable Ranges (PAR) and robust operating setpoints.'
          ],
          alternative: {
            id: alt.id,
            key: alt.key,
            name: alt.name,
            shortName: alt.shortName,
            category: alt.category,
            runBadge: '15 to 20 Runs',
            hint: 'CCD Face-Centered if corner operating points must be tested'
          }
        }
      } else {
        const d = findDesign('ccd')
        const alt = findDesign('bbd')
        return {
          design: d,
          matchScore: 99,
          runBadge: 'Total: 16 to 20 Runs',
          capabilityBadge: 'Full Quadratic Response Surface (High Precision)',
          recommendedPhase: 'optimization',
          whyFitsBullets: [
            'Gold-standard design for formal regulatory Design Space definition under ICH Q8(R2).',
            'Uniform prediction variance in all directions from the center operating point.',
            'Enables multi-objective optimization with simultaneous Desirability Functions.'
          ],
          alternative: {
            id: alt.id,
            key: alt.key,
            name: alt.name,
            shortName: alt.shortName,
            category: alt.category,
            runBadge: '13 to 15 Runs',
            hint: 'Box-Behnken if physical factor extremes must be avoided'
          }
        }
      }
    } else if (factorCount === 'moderate') {
      if (priority === 'fast') {
        const d = findDesign('bbd')
        const alt = findDesign('d_optimal')
        return {
          design: d,
          matchScore: 96,
          runBadge: 'Total: 44 to 48 Runs (5 factors)',
          capabilityBadge: 'Spherical Response Surface Optimization',
          recommendedPhase: 'optimization',
          whyFitsBullets: [
            'Significantly fewer runs than Central Composite at 5 factors while maintaining curvature.',
            'Protected boundary geometry prevents equipment overload and harsh reaction states.',
            'Provides reliable lack-of-fit error estimation for regulatory filing.'
          ],
          alternative: {
            id: alt.id,
            key: alt.key,
            name: alt.name,
            shortName: alt.shortName,
            category: alt.category,
            runBadge: '25 to 35 Runs',
            hint: 'D-Optimal algorithmic design for tighter run budgets'
          }
        }
      } else {
        const d = findDesign('ccd')
        const alt = findDesign('d_optimal')
        return {
          design: d,
          matchScore: 98,
          runBadge: 'Total: 32 to 54 Runs',
          capabilityBadge: 'Full Response Surface Design Space (Face-Centered)',
          recommendedPhase: 'optimization',
          whyFitsBullets: [
            'Face-centered points stay strictly within validated operational boundaries (no extrapolation).',
            'Estimates all linear, two-factor interaction, and quadratic curvature terms.',
            'Defines robust Normal Operating Ranges (NOR) and Proven Acceptable Ranges (PAR).'
          ],
          alternative: {
            id: alt.id,
            key: alt.key,
            name: alt.name,
            shortName: alt.shortName,
            category: alt.category,
            runBadge: '30 to 42 Runs',
            hint: 'D-Optimal to minimize prediction variance under constrained runs'
          }
        }
      }
    } else {
      // 9+ factors optimization
      if (priority === 'fast') {
        const d = findDesign('dsd')
        const alt = findDesign('d_optimal')
        return {
          design: d,
          matchScore: 94,
          runBadge: 'Total: 21 to 25 Runs',
          capabilityBadge: 'Screening with Curvature Triage',
          recommendedPhase: 'screening',
          whyFitsBullets: [
            'Testing 9+ factors directly in RSM causes severe run inflation; DSD triages factors first.',
            'Detects active quadratic curvature and weeds out inert factors in one step.',
            'Prepares a focused 3-to-5 factor subset for subsequent high-precision RSM.'
          ],
          alternative: {
            id: alt.id,
            key: alt.key,
            name: alt.name,
            shortName: alt.shortName,
            category: alt.category,
            runBadge: '40 to 55 Runs',
            hint: 'D-Optimal if all 9 factors must remain in quadratic model'
          }
        }
      } else {
        const d = findDesign('d_optimal')
        const alt = findDesign('bayesian_gp')
        return {
          design: d,
          matchScore: 97,
          runBadge: 'Total: 40 to 55 Runs',
          capabilityBadge: 'Algorithmic Quadratic Optimization',
          recommendedPhase: 'optimization',
          whyFitsBullets: [
            'Computer-generated matrix maximizes determinant |X^T X| to minimize estimation error.',
            'Fits full quadratic response surface within a practical, custom run budget.',
            'Accommodates irregular operating windows, batch constraints, and safety exclusion zones.'
          ],
          alternative: {
            id: alt.id,
            key: alt.key,
            name: alt.name,
            shortName: alt.shortName,
            category: alt.category,
            runBadge: '15 to 25 Sequential Batches',
            hint: 'Bayesian Active Learning for iterative, high-cost batch campaigns'
          }
        }
      }
    }
  } else {
    // mixture
    if (factorCount === 'few') {
      if (priority === 'fast') {
        const d = findDesign('mixture')
        const alt = findDesign('d_optimal')
        return {
          design: d,
          matchScore: 98,
          runBadge: 'Total: 7 to 10 Runs',
          capabilityBadge: 'Scheffé Polynomial (Pure & Binary Blends)',
          recommendedPhase: 'optimization',
          whyFitsBullets: [
            'Specifically designed for formulation components whose sum must equal 100%.',
            'Evaluates pure components, binary blends, and overall centroid with minimal runs.',
            'Identifies excipient synergies and antagonistic solubility effects.'
          ],
          alternative: {
            id: alt.id,
            key: alt.key,
            name: alt.name,
            shortName: alt.shortName,
            category: alt.category,
            runBadge: '8 to 12 Runs',
            hint: 'D-Optimal Mixture if components have individual upper/lower bounds'
          }
        }
      } else {
        const d = findDesign('mixture')
        const alt = findDesign('d_optimal')
        return {
          design: d,
          matchScore: 99,
          runBadge: 'Total: 14 to 18 Runs (Augmented)',
          capabilityBadge: 'Special Cubic Scheffé Model + Axial Checks',
          recommendedPhase: 'optimization',
          whyFitsBullets: [
            'Augmented with axial check blends to estimate true experimental error and lack of fit.',
            'Detects complex 3-component synergistic solubility and stabilization effects.',
            'Enables precise ternary contour mapping for regulatory formulation filing.'
          ],
          alternative: {
            id: alt.id,
            key: alt.key,
            name: alt.name,
            shortName: alt.shortName,
            category: alt.category,
            runBadge: '12 to 16 Runs',
            hint: 'D-Optimal Mixture for restricted ratio regions'
          }
        }
      }
    } else if (factorCount === 'moderate') {
      if (priority === 'fast') {
        const d = findDesign('mixture')
        const alt = findDesign('d_optimal')
        return {
          design: d,
          matchScore: 96,
          runBadge: 'Total: 25 to 35 Runs',
          capabilityBadge: 'Scheffé Linear + Quadratic Formulation',
          recommendedPhase: 'optimization',
          whyFitsBullets: [
            'Standard formulation baseline for multi-excipient or surfactant-oil-water matrices.',
            'Isolates pairwise excipient interactions and overall formulation stability sweet spots.',
            'Ensures proportional integrity across all tested formulation candidates.'
          ],
          alternative: {
            id: alt.id,
            key: alt.key,
            name: alt.name,
            shortName: alt.shortName,
            category: alt.category,
            runBadge: '20 to 28 Runs',
            hint: 'D-Optimal Mixture if ingredients have tight percentage ranges'
          }
        }
      } else {
        const d = findDesign('d_optimal')
        const alt = findDesign('mixture')
        return {
          design: d,
          matchScore: 98,
          runBadge: 'Total: 28 to 38 Runs',
          capabilityBadge: 'Constrained Scheffé Optimization',
          recommendedPhase: 'optimization',
          whyFitsBullets: [
            'Essential when excipients have strict percentage ranges (e.g. binder 2–5%, disintegrant 1–3%).',
            'Prevents creating unfeasible formulation recipes outside realistic manufacturing limits.',
            'Generates orthogonal candidate points along the constrained formulation boundary.'
          ],
          alternative: {
            id: alt.id,
            key: alt.key,
            name: alt.name,
            shortName: alt.shortName,
            category: alt.category,
            runBadge: '35 Runs',
            hint: 'Simplex Centroid if the whole unconstrained simplex space is open'
          }
        }
      }
    } else {
      // 9+ components
      if (priority === 'fast') {
        const d = findDesign('d_optimal')
        const alt = findDesign('mixture')
        return {
          design: d,
          matchScore: 95,
          runBadge: 'Total: 35 to 50 Runs',
          capabilityBadge: 'Constrained High-Component Mixture',
          recommendedPhase: 'optimization',
          whyFitsBullets: [
            'Standard simplex grids explode exponentially at 9+ components; D-Optimal keeps runs tractable.',
            'Focuses experimental runs on boundary vertices, edge midpoints, and overall center.',
            'Identifies major active formulation drivers with high parameter efficiency.'
          ],
          alternative: {
            id: alt.id,
            key: alt.key,
            name: alt.name,
            shortName: alt.shortName,
            category: alt.category,
            runBadge: '50+ Runs',
            hint: 'Simplex Centroid screening'
          }
        }
      } else {
        const d = findDesign('d_optimal')
        const alt = findDesign('bayesian_gp')
        return {
          design: d,
          matchScore: 97,
          runBadge: 'Total: 48 to 65 Runs',
          capabilityBadge: 'Algorithmic Scheffé Polynomial',
          recommendedPhase: 'optimization',
          whyFitsBullets: [
            'Strictly enforces multi-component ratio inequalities (e.g., polymer-to-plasticizer > 3:1).',
            'Calculates minimum-variance parameter estimates across the restricted formulation domain.',
            'Rigorous formulation basis for multi-response dissolution and stability optimization.'
          ],
          alternative: {
            id: alt.id,
            key: alt.key,
            name: alt.name,
            shortName: alt.shortName,
            category: alt.category,
            runBadge: '20 to 30 Sequential Batches',
            hint: 'Bayesian Active Learning for automated formulation robots'
          }
        }
      }
    }
  }
}

