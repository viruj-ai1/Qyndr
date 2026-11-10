export interface StepBriefing {
  id: string;
  step: number;
  title: string;
  purpose: string;
  youDo: string[];
  systemDoes: string[];
  output: string;
}

export const STEP_BRIEFINGS: Record<string, StepBriefing> = {
  'create-project': {
    id: 'create-project',
    step: 1,
    title: 'Create Project',
    purpose: 'Set up the project foundation with API/compound details and overarching development goals.',
    youDo: [
      'Enter the project name, compound/molecule name, and dosage/process type.',
      'Specify the project objective and context notes.'
    ],
    systemDoes: [
      'Initializes a persistent QbD project repository.',
      'Configures data tracking across all subsequent development phases.'
    ],
    output: 'A centralized project record that all later stages and DOE matrices attach to.'
  },

  'qtpp': {
    id: 'qtpp',
    step: 2,
    title: 'QTPP Definition',
    purpose: 'Define the Quality Target Product Profile stating target therapeutic & manufacturing requirements.',
    youDo: [
      'Define dosage form, route of administration, and strength.',
      'Establish target clinical specifications, stability, and release criteria.'
    ],
    systemDoes: [
      'Structures product quality criteria aligned with ICH Q8(R2) guidelines.',
      'Pre-populates candidate targets using AI/QbD reference templates.'
    ],
    output: 'QTPP specification table serving as the baseline to derive Critical Quality Attributes.'
  },

  'cqa': {
    id: 'cqa',
    step: 3,
    title: 'CQA Derivation',
    purpose: 'Identify and prioritize Critical Quality Attributes that directly impact patient safety and efficacy.',
    youDo: [
      'Review prospective CQAs (assay, purity, dissolution, related substances, etc.).',
      'Assign criticality rankings, acceptance limits, and target thresholds.'
    ],
    systemDoes: [
      'Maps each CQA back to corresponding QTPP clinical elements.',
      'Calculates severity impact scores and identifies release testing boundaries.'
    ],
    output: 'Prioritized CQA registry with validated specification limits.'
  },

  'route-mapping': {
    id: 'route-mapping',
    step: 4,
    title: 'Route Mapping',
    purpose: 'Map synthetic chemistry routes, unit operations, input materials, and process conditions.',
    youDo: [
      'Define process stages (e.g., Coupling, Crystallization, Filtration).',
      'Specify input raw materials, reagents, solvents, and target intermediate outputs.'
    ],
    systemDoes: [
      'Generates an interactive process flow architecture.',
      'Binds material inputs (CMAs) and process parameters (CPPs) to specific operational stages.'
    ],
    output: 'Detailed process map linking chemistry unit operations to potential risk factors.'
  },

  'risk-assessment': {
    id: 'risk-assessment',
    step: 5,
    title: 'Risk Assessment',
    purpose: 'Perform reverse FMEA risk analysis to evaluate which parameters could potentially deviate CQAs.',
    youDo: [
      'Evaluate process parameters and raw material attributes across all unit ops.',
      'Score Severity (S), Occurrence (O), and Detectability (D) on standard 1–5 scales.',
      'Adjust the RPN Critical Cutoff threshold if needed.'
    ],
    systemDoes: [
      'Computes Risk Priority Numbers (RPN = S × O × D) per parameter.',
      'Automatically sorts parameters and flags critical CPP/CMA candidates.'
    ],
    output: 'Ranked FMEA risk matrix isolating high-risk parameters requiring empirical DOE study.'
  },

  'stage-campaign-matrix': {
    id: 'stage-campaign-matrix',
    step: 6,
    title: 'Stage Campaign Matrix',
    purpose: 'Select and activate the specific manufacturing unit operation to optimize in this DOE campaign.',
    youDo: [
      'Review process stages with their critical parameter counts and risk statuses.',
      'Select the active stage/campaign to progress into experimental design.'
    ],
    systemDoes: [
      'Filters CPP candidates and responses specific to the selected unit operation.',
      'Carries forward stage-specific parameters into DOE factor definition.'
    ],
    output: 'Active campaign context configured for experimental study.'
  },

  'define-factors': {
    id: 'define-factors',
    step: 7,
    title: 'Define Factors & Responses',
    purpose: 'Establish operational ranges for process factors and quantitative metrics for response variables.',
    youDo: [
      'Set low, high, and baseline operating levels and engineering units for each factor.',
      'Confirm response variables (CQAs), measurement units, and goals (Maximize, Minimize, or Target).'
    ],
    systemDoes: [
      'Validates factor numeric ranges, degrees of freedom, and constraints.',
      'Prepares mathematical design space bounds for DOE algorithmic generation.'
    ],
    output: 'Rigorous factor and response definition governing experimental design construction.'
  },

  'recommend-doe': {
    id: 'recommend-doe',
    step: 8,
    title: 'Recommend DOE',
    purpose: 'Evaluate factor space geometry and recommend the optimal experimental design strategy.',
    youDo: [
      'Review recommended designs (e.g., Definitive Screening, Fractional Factorial, CCD, Box-Behnken).',
      'Use the 3-Question Selection Wizard to align on screening vs. optimization rigor.'
    ],
    systemDoes: [
      'Analyzes factor count (k), interaction resolution, and run budget efficiency.',
      'Provides statistical rationale and run economy comparisons aligned with ICH Q8(R2).'
    ],
    output: 'Selected DOE design architecture with target run counts and center points.'
  },

  'generate-doe': {
    id: 'generate-doe',
    step: 9,
    title: 'DOE Matrix & Results',
    purpose: 'Generate randomized experimental run matrix, execute laboratory trials, and record response data.',
    youDo: [
      'Export or review randomized run conditions (temperature, time, stoichiometry, etc.).',
      'Execute lab experiments and input observed analytical results for each run.'
    ],
    systemDoes: [
      'Constructs the randomized orthogonal or D-optimal design matrix with center points.',
      'Validates experimental observations and prepares dataset for regression modeling.'
    ],
    output: 'Completed empirical dataset ready for statistical and machine learning analysis.'
  },

  'initial-optimization': {
    id: 'initial-optimization',
    step: 10,
    title: 'Initial Optimum',
    purpose: 'Fit response surface regression models to uncover factor effects and identify initial sweet spot.',
    youDo: [
      'Inspect ANOVA tables, Pareto effect charts, and R² goodness-of-fit metrics.',
      'Review the initial optimal parameter coordinates and predicted response values.'
    ],
    systemDoes: [
      'Fits OLS polynomial regression models (linear, 2-factor interaction, and quadratic).',
      'Evaluates Derringer-Suich desirability functions to locate the initial composite optimum.'
    ],
    output: 'First-iteration optimal parameter coordinates and initial empirical model.'
  },

  'enough-data': {
    id: 'enough-data',
    step: 11,
    title: 'Enough Data?',
    purpose: 'Assess model predictive certainty and determine whether to proceed directly or run Bayesian iterations.',
    youDo: [
      'Review model uncertainty, R² vs Q² predictive spread, and design space coverage.',
      'Choose between completing optimization or triggering active learning via Bayesian loop.'
    ],
    systemDoes: [
      'Calculates residual standard error and epistemic uncertainty across design space.',
      'Generates decision guidance: finalize design space or refine with Bayesian iterations.'
    ],
    output: 'Workflow branch decision: finalize optimum or proceed to active GP learning.'
  },

  'gp-model': {
    id: 'gp-model',
    step: 12,
    title: 'GP Model',
    purpose: 'Fit non-parametric Gaussian Process regression surrogate to model complex response behaviors.',
    youDo: [
      'Inspect 1D factor slice curves with 95% confidence bands around the optimum.',
      'Evaluate log marginal likelihood and kernel hyperparameter convergence.'
    ],
    systemDoes: [
      'Trains Gaussian Process Regressors with Matérn-5/2 covariance kernels.',
      'Quantifies aleatoric noise and epistemic uncertainty across the multi-factor space.'
    ],
    output: 'Trained GP probabilistic model providing mean predictions and uncertainty intervals.'
  },

  'bayesian-opt': {
    id: 'bayesian-opt',
    step: 13,
    title: 'Bayesian Optimization',
    purpose: 'Leverage acquisition functions to balance exploration and exploitation for the next experiment.',
    youDo: [
      'Select acquisition strategy (Expected Improvement, UCB, or Probability of Improvement).',
      'Review recommended factor settings for the next experimental run.'
    ],
    systemDoes: [
      'Optimizes acquisition function across the multi-dimensional factor landscape.',
      'Pinpoints operating conditions offering maximum potential response gain or uncertainty reduction.'
    ],
    output: 'High-utility candidate experiment recipe recommended for laboratory testing.'
  },

  'new-experiment': {
    id: 'new-experiment',
    step: 14,
    title: 'New Experiment',
    purpose: 'Execute the Bayesian-recommended experiment in the laboratory and record observed responses.',
    youDo: [
      'Conduct the targeted experiment at the specified factor coordinates.',
      'Input the measured analytical results into the workflow.'
    ],
    systemDoes: [
      'Appends the new experimental run to the project dataset.',
      'Updates Bayesian iteration counters and refits Gaussian Process models.'
    ],
    output: 'Updated empirical dataset enriching the surrogate model with targeted knowledge.'
  },

  'final-optimum': {
    id: 'final-optimum',
    step: 15,
    title: 'Final Optimum',
    purpose: 'Synthesize all empirical runs to establish the global Pareto optimum and Proven Acceptable Ranges.',
    youDo: [
      'Evaluate Global Composite Desirability against the Quality Target (80%).',
      'Inspect Proven Acceptable Ranges (PAR) and Normal Operating Ranges (NOR) per factor.',
      'Review multi-objective trade-offs across all individual CQAs.'
    ],
    systemDoes: [
      'Computes global multi-response sweet spot via Differential Evolution on GP surrogates.',
      'Generates ICH Q8(R2)-compliant design space boundaries and 95% confidence intervals.'
    ],
    output: 'Validated optimal setpoints and robust regulatory design space boundaries (PAR/NOR).'
  },

  'report': {
    id: 'report',
    step: 16,
    title: 'Generate Report',
    purpose: 'Compile comprehensive QbD regulatory summary documenting the complete development lifecycle.',
    youDo: [
      'Review the end-to-end traceability matrix from QTPP → CQAs → CPPs → DOE → Optimum.',
      'Export audit-ready regulatory reports and experiment records.'
    ],
    systemDoes: [
      'Aggregates project metadata, risk scoring, DOE matrices, models, and design space.',
      'Generates printable, audit-ready ICH Q8(R2) development summary.'
    ],
    output: 'Comprehensive QbD regulatory report package ready for tech transfer or filing.'
  }
};

