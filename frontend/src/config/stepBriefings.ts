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
    title: 'Project Setup & QTPP',
    purpose: 'Set up the project foundation, compound details, unit operation type, and define the Quality Target Product Profile.',
    youDo: [
      'Enter the project name, compound/molecule name, and select the Unit Operation Type.',
      'Specify the project objective and context notes.',
      'Define target clinical specifications, stability, and release criteria in the QTPP table.'
    ],
    systemDoes: [
      'Initializes a persistent single-stage QbD project repository.',
      'Structures product quality criteria aligned with ICH Q8(R2) guidelines.'
    ],
    output: 'A centralized project record and QTPP specification table serving as the baseline to derive Critical Quality Attributes.'
  },

  'cqa-risk': {
    id: 'cqa-risk',
    step: 2,
    title: 'CQA & Risk Assessment',
    purpose: 'Derive Critical Quality Attributes from QTPP and perform reverse risk assessment across process parameters.',
    youDo: [
      'Review and assess CQAs (assay, purity, impurities, physical properties) with severity and uncertainty scores.',
      'Evaluate process parameters and raw material attributes for the active unit operation.',
      'Link candidate process parameters to CQAs and score Severity, Occurrence, and Detectability.'
    ],
    systemDoes: [
      'Calculates CQA Criticality scores and Risk Priority Numbers (RPN = S × O × D).',
      'Flags high-risk parameters (RPN ≥ threshold) as candidate Critical Process Parameters (CPPs).'
    ],
    output: 'Prioritized CQA registry and ranked FMEA risk matrix isolating high-risk parameters for DoE.'
  },

  'define-factors': {
    id: 'define-factors',
    step: 3,
    title: 'Define Factors & Responses',
    purpose: 'Establish operational ranges for process factors and quantitative metrics for response variables.',
    youDo: [
      'Select active synthesis stage (for multi-stage projects) and manage campaign status.',
      'Set low, high, and baseline operating levels and engineering units for each factor.',
      'Confirm response variables (CQAs), measurement units, and goals (Maximize, Minimize, or Target).'
    ],
    systemDoes: [
      'Pre-populates high-risk CPPs from CQA risk assessment into the active stage.',
      'Validates factor numeric ranges, degrees of freedom, and constraints.',
      'Prepares mathematical design space bounds for DOE algorithmic generation.'
    ],
    output: 'Rigorous factor and response definition governing experimental design construction.'
  },

  'recommend-doe': {
    id: 'recommend-doe',
    step: 4,
    title: 'Recommend DOE',
    purpose: 'Evaluate factor space geometry and recommend the optimal experimental design strategy.',
    youDo: [
      'Review recommended designs (e.g., Definitive Screening, Fractional Factorial, CCD, Box-Behnken).',
      'Use the 3-Step Design Advisor to align on screening vs. optimization rigor.'
    ],
    systemDoes: [
      'Analyzes factor count (k), interaction resolution, and run budget efficiency.',
      'Provides statistical rationale and run economy comparisons aligned with ICH Q8(R2).'
    ],
    output: 'Selected DOE design architecture with target run counts and center points.'
  },

  'generate-doe': {
    id: 'generate-doe',
    step: 5,
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
    step: 6,
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
    step: 7,
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
    step: 8,
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
    step: 9,
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
    step: 10,
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
    step: 11,
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
    step: 12,
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
