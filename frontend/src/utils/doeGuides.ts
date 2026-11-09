// ============================================================
// frontend/src/utils/doeGuides.ts
// Chemist's Decision Guide & Reference Data for DoE Selection
// Aligned with ICH Q8(R2), ICH Q9(R1), and ICH Q11
// ============================================================

export interface ChemistGuideCondition {
  condition: string;
  recommendedAlternativeId?: string; // Links to another design ID (e.g., 'dsd', 'ccd', 'bbd', 'fractional_factorial')
  alternativeLabel?: string;
}

export interface ChemistDecisionGuide {
  id: string; // matches DoEDesignManualEntry.id ('pb', 'fractional_factorial', 'taguchi', 'dsd', 'full_factorial', 'bbd', 'ccd', 'mixture', 'd_optimal', 'bayesian_gp')
  whyChoose: string[];
  chooseWhen: ChemistGuideCondition[];
  avoidWhen: ChemistGuideCondition[];
  howItWorks: string;
  modelAndEffects: {
    canEstimate: string[];
    cannotEstimate: string[];
    modelEquation: string;
    modelEquationExplanation: string;
  };
  aliasingAndResolution: {
    resolutionLevel: string;
    confoundingExplanation: string;
    practicalMeaning: string;
  };
  runCountLogic: {
    formula: string;
    tableOrExamples: string;
    centerPointsGuidance: string;
    replicatesGuidance: string;
  };
  assumptions: string[];
  strengths: string[];
  limitations: string[];
  chemistryExamples: string[];
  qbdLink: {
    qbdWorkflowStage: string;
    designSpaceRole: string;
    ichGuidanceDetails: string;
  };
  nextStep: string;
  commonMistakes: string[];
  analysisTips: string[];
  caseStudyLink: {
    whyThisDesignForThisCase: string;
    whatWouldGoWrongWithPoorerChoice: string;
  };
}

export const CHEMIST_DECISION_GUIDES: Record<string, ChemistDecisionGuide> = {
  // ------------------------------------------------------------
  // 1. Plackett-Burman Design (PB)
  // ------------------------------------------------------------
  pb: {
    id: 'pb',
    whyChoose: [
      'Maximum run economy when dealing with large pools of candidate process parameters (8 to 20 variables).',
      'Rapidly separates the vital few Critical Process Parameters (CPPs) from trivial non-critical variables.',
      'Saves high-value active pharmaceutical ingredient (API), expensive catalysts, and pilot plant equipment time.',
      'Constructs orthogonal linear contrast matrices where every main effect is evaluated independently of other main effects.',
      'Ideal regulatory first step under ICH Q9 Risk Management to justify locking non-critical factors to fixed setpoints.'
    ],
    chooseWhen: [
      { condition: 'Candidate factor count is high (8 to 20 continuous or 2-level categorical parameters).' },
      { condition: 'Experimental run budget is strictly limited (cannot afford more than 12 to 24 total runs).' },
      { condition: 'Early route discovery, lead optimization, or initial chemical unit operation triage stage.' },
      { condition: 'Goal is purely screening to eliminate inert parameters before investing in response surface designs.' },
      { condition: 'Prior knowledge or risk assessment (FMEA) indicates that 2-factor interactions are secondary to main drivers.' }
    ],
    avoidWhen: [
      {
        condition: 'Synergistic or antagonistic 2-factor interactions are strongly suspected (e.g., Temp x Catalyst loading).',
        recommendedAlternativeId: 'fractional_factorial',
        alternativeLabel: 'Fractional Factorial (Res IV/V)'
      },
      {
        condition: 'Curvature or non-linear optima are expected inside the parameter ranges.',
        recommendedAlternativeId: 'dsd',
        alternativeLabel: 'Definitive Screening Design (DSD)'
      },
      {
        condition: 'Only 3 to 5 factors are under investigation.',
        recommendedAlternativeId: 'bbd',
        alternativeLabel: 'Box-Behnken (BBD)'
      },
      {
        condition: 'Final ICH Q8 regulatory Design Space and sweet spot mapping is required.',
        recommendedAlternativeId: 'ccd',
        alternativeLabel: 'Central Composite (CCD)'
      }
    ],
    howItWorks: 'Plackett-Burman designs are special fractional 2-level designs where total runs are multiples of 4 (N = 12, 16, 20, 24). They assign factors across orthogonal balanced columns of high (+1) and low (-1) levels so that each factor appears equally with the highs and lows of every other factor. This mathematical balance (orthogonality: factors are mathematically independent so each effect is measured without correlation) isolates the linear slope of each variable in minimal runs.',
    modelAndEffects: {
      canEstimate: [
        'Linear main effects (first-order terms beta_i) for all tested factors',
        'Directionality of parameter influence (increasing or decreasing the response)'
      ],
      cannotEstimate: [
        'Two-factor interactions (beta_ij) without heavy confounding/aliasing',
        'Quadratic curvature or non-linear response peaks (beta_ii)'
      ],
      modelEquation: 'Y = beta_0 + sum(beta_i * X_i) + epsilon',
      modelEquationExplanation: 'A purely linear first-order equation containing only the overall average (intercept beta_0) and individual factor main effects (beta_i * X_i), assuming interactions and curvature are negligible.'
    },
    aliasingAndResolution: {
      resolutionLevel: 'Resolution III',
      confoundingExplanation: 'Every main effect is aliased (confounded or mathematically tangled) with multiple 2-factor interactions. For example, in a 12-run PB design, the apparent effect of Temperature is mathematically mixed with combinations of Time x Catalyst, Base x Solvent, etc.',
      practicalMeaning: 'If two factors have a strong synergistic chemical interaction, that synergy will falsely inflate or cancel out an unrelated main effect. Never use PB to prove that an interaction does not exist.'
    },
    runCountLogic: {
      formula: 'N = k + 1 rounded up to the nearest multiple of 4 (e.g. k=8 -> 12 runs, k=11 -> 12 runs, k=15 -> 16 runs).',
      tableOrExamples: 'k=8: 12 runs | k=11: 12 runs | k=15: 16 runs | k=19: 20 runs',
      centerPointsGuidance: 'Add 3 to 4 center points (all continuous factors at their midpoint) to check for curvature and obtain an independent estimate of experimental pure error.',
      replicatesGuidance: 'Full matrix replication is rarely performed in PB screening; replicate center runs instead to measure assay/analytical repeatability.'
    },
    assumptions: [
      'Effect Sparsity Principle: Only a small fraction (typically 20%) of candidate factors are genuinely active drivers of the CQAs.',
      'Effect Hierarchy: Linear main effects are substantially larger in magnitude than 2-factor and higher-order interactions.',
      'Negligible Curvature: Within the chosen screening ranges, response surfaces are approximately planar.'
    ],
    strengths: [
      'Unmatched efficiency: screens up to 11 factors in only 12 runs.',
      'Zero correlation among main effects: each linear slope is calculated without interference from other main effects.',
      'Saves time and raw materials in early-phase route development.',
      'Generates clear Pareto charts of linear factor importance.'
    ],
    limitations: [
      'Severe aliasing: main effects are confounded with two-factor interactions.',
      'Cannot locate non-linear optima or saddle points.',
      'If interactions are large, follow-up foldover runs (running an inverted mirror matrix) are mandatory.'
    ],
    chemistryExamples: [
      'API coupling reaction: screening 10 parameters (solvent volume, agitator speed, moisture, catalyst, base eq, addition rate, reaction temp, quench temp, aging time, inert gas flow).',
      'HPLC method screening: evaluating 9 column chemistry and mobile phase modifier variables for initial chromatographic retention.',
      'Milling unit operation: triage of rotor speed, feed rate, screen mesh, carrier flow, and nozzle pressure on particle size distribution.'
    ],
    qbdLink: {
      qbdWorkflowStage: 'Phase 0 Risk Assessment (FMEA/RPN) -> Early Screening',
      designSpaceRole: 'Cannot define an ICH Q8 Design Space directly. Used to justify downgrading high-RPN potential parameters to non-critical status, narrowing the focus to genuine Critical Process Parameters (CPPs).',
      ichGuidanceDetails: 'Directly supports ICH Q9(R1) Risk Management by providing quantitative empirical evidence to de-risk variables identified in Ishikawa fishbone diagrams.'
    },
    nextStep: 'Identify the 2 to 4 statistically significant factors on the Pareto chart, fix all insignificant factors at practical operating levels, and advance the active factors into a Box-Behnken (BBD) or Central Composite (CCD) optimization design.',
    commonMistakes: [
      'Setting factor ranges too narrow, resulting in active factors appearing statistically insignificant.',
      'Setting factor ranges too wide into biphasic or precipitation failure zones where linear assumptions collapse.',
      'Assuming an active main effect has no interaction when Resolution III explicitly disguises interactions.',
      'Omitting center points, leaving zero degrees of freedom to test for curvature.'
    ],
    analysisTips: [
      'Generate a half-normal or Pareto plot of effects to distinguish genuine signals from random background noise.',
      'Examine ANOVA p-values (threshold p < 0.05) and effect coefficients.',
      'Check center point p-value for curvature; a significant curvature p-value indicates immediate need for an RSM design.',
      'Perform residual diagnostic checks (normal probability plot of residuals) to detect analytical outliers.'
    ],
    caseStudyLink: {
      whyThisDesignForThisCase: 'In the Stage 1 Alkylation case study, 11 parameters were flagged by the Ishikawa risk assessment. Running a full factorial would require 2,048 runs. A 12-run Plackett-Burman screen was the optimal scientific choice because it evaluated all 11 variables simultaneously in just 12 runs, identifying Catalyst Loading, Base Ratio, and Temperature as the primary drivers of dimer impurity.',
      whatWouldGoWrongWithPoorerChoice: 'Choosing a full factorial (2,048 runs) would consume kilograms of intermediate and stall the project for months. Conversely, changing one-factor-at-a-time (OFAT) would have missed multi-parameter trends and required over 30 isolated experiments with zero statistical error control.'
    }
  },

  // ------------------------------------------------------------
  // 2. Fractional Factorial Design (2^(k-p))
  // ------------------------------------------------------------
  fractional_factorial: {
    id: 'fractional_factorial',
    whyChoose: [
      'Balanced middle ground between run economy and interaction detection power.',
      'Resolves main effects cleanly from two-factor interactions (at Resolution IV and V).',
      'Detects chemical synergies and antagonisms (e.g. Acid catalyst accelerating reaction only at elevated temperature).',
      'Enables sequential augmentation: can be folded over or upgraded to a Central Composite Design (CCD) later.',
      'Standard regulatory design under ICH Q8 for characterizing multi-variable process windows.'
    ],
    chooseWhen: [
      { condition: 'Investigating 4 to 8 continuous or 2-level categorical factors.' },
      { condition: 'Run budget allows 8 to 32 runs.' },
      { condition: 'You suspect 2-factor interactions may be chemically significant.' },
      { condition: 'Development stage is process characterization or late screening.' },
      { condition: 'Factor ranges are well-chosen based on prior screening or physical chemistry.' }
    ],
    avoidWhen: [
      {
        condition: 'Investigating 9 or more factors with a very tight budget (< 16 runs).',
        recommendedAlternativeId: 'pb',
        alternativeLabel: 'Plackett-Burman (PB)'
      },
      {
        condition: 'Non-linear curvature is strongly expected and needs estimation without extra runs.',
        recommendedAlternativeId: 'dsd',
        alternativeLabel: 'Definitive Screening Design (DSD)'
      },
      {
        condition: 'Full second-order quadratic response surface and sweet spot is required.',
        recommendedAlternativeId: 'bbd',
        alternativeLabel: 'Box-Behnken (BBD)'
      },
      {
        condition: 'Factors are ingredients whose proportions sum to 100%.',
        recommendedAlternativeId: 'mixture',
        alternativeLabel: 'Mixture Design'
      }
    ],
    howItWorks: 'Fractional Factorial designs run a carefully selected fraction (1/2, 1/4, 1/8, etc.) of a full 2^k factorial matrix. By choosing specific mathematical generators (design relations), the highest-order interactions (which are rarely physically real) are sacrificed to estimate main effects and critical 2-factor interactions in half or quarter the runs.',
    modelAndEffects: {
      canEstimate: [
        'Linear main effects (beta_i)',
        'Two-factor interactions (beta_ij) when using Resolution V designs (or Resolution IV with caution)'
      ],
      cannotEstimate: [
        'Quadratic curvature terms (beta_ii) across individual factors (only overall curvature if center points are added)',
        'Higher-order interactions (3-way or 4-way terms)'
      ],
      modelEquation: 'Y = beta_0 + sum(beta_i * X_i) + sum(beta_ij * X_i * X_j) + epsilon',
      modelEquationExplanation: 'A two-factor interaction model that captures both the individual impact of each factor and how factors modulate each other (synergies/antagonisms).'
    },
    aliasingAndResolution: {
      resolutionLevel: 'Resolution IV (k=4: 8 runs) or Resolution V (k=5: 16 runs; k=6: 32 runs)',
      confoundingExplanation: 'In Resolution IV, main effects are clear of 2FIs, but 2FIs are aliased with each other (e.g. AB = CD). In Resolution V, main effects and 2FIs are completely clear of other main effects and 2FIs.',
      practicalMeaning: 'At Resolution IV, if interaction AB is significant, you must check whether CD could be causing it. At Resolution V, every 2-factor interaction is uniquely estimated without ambiguity.'
    },
    runCountLogic: {
      formula: 'N = 2^(k-p) + C0 center points (e.g. 2^(4-1) = 8 runs; 2^(5-1) = 16 runs; 2^(6-1) = 32 runs).',
      tableOrExamples: 'k=4: 8 runs (Res IV) | k=5: 16 runs (Res V) | k=6: 32 runs (Res V) | k=7: 32 runs (Res IV)',
      centerPointsGuidance: 'Add 3 to 5 center points to estimate pure experimental error and check for overall quadratic curvature.',
      replicatesGuidance: 'Replicating center points is standard; full corner replication is only done if process noise is exceptionally high.'
    },
    assumptions: [
      'Hierarchy of Effects: Main effects > 2-factor interactions > 3-factor interactions.',
      'Sparsity of Effects: Not all mathematically possible interactions are chemically active.',
      'Approximate Linearity: The response between -1 and +1 levels behaves linearly unless center points prove curvature.'
    ],
    strengths: [
      'Clean estimation of two-factor interactions at Resolution V.',
      'Clear alias pattern so the chemist knows exactly what is confounded.',
      'Sequential building block: easily augmented with axial runs to form a Central Composite Design (CCD).',
      'Provides high statistical power with half the runs of a full factorial.'
    ],
    limitations: [
      'Resolution IV designs leave 2FIs aliased with other 2FIs, requiring chemical judgment to deconvolute.',
      'Cannot estimate separate quadratic curvature for each factor without adding star/axial points.',
      'Requires 2 levels per factor, missing non-monotonic optima if ranges are overly broad.'
    ],
    chemistryExamples: [
      'Fluid bed granulation: testing spray rate, atomization air pressure, inlet air temp, product temp, and binder concentration.',
      'Flow chemistry hydrogenation: studying pressure, liquid flow rate, hydrogen gas ratio, residence time, and catalyst bed temp.',
      'API crystallization: investigating cooling rate, anti-solvent addition rate, seed loading, and agitation RPM on crystal aspect ratio.'
    ],
    qbdLink: {
      qbdWorkflowStage: 'Screening -> Process Characterization',
      designSpaceRole: 'Establishes initial Proven Acceptable Ranges (PAR) and confirms Critical Process Parameters (CPPs) by demonstrating whether parameter interactions exist.',
      ichGuidanceDetails: 'Directly cited in ICH Q8(R2) Section 2.4 as the preferred tool for identifying interaction effects that define multidimensional operational boundaries.'
    },
    nextStep: 'If curvature is absent, lock non-significant factors and establish linear operational ranges. If curvature is detected via center points, add axial (star) points to convert this design directly into a Central Composite Design (CCD).',
    commonMistakes: [
      'Selecting a Resolution III fraction for 5 factors (8 runs) when interaction knowledge is critical.',
      'Failing to de-alias confounded 2FI pairs in Resolution IV before drawing scientific conclusions.',
      'Forgetting center points, making it impossible to detect non-linear sweet spots.',
      'Randomizing runs incorrectly when one factor is difficult to reset.'
    ],
    analysisTips: [
      'Use ANOVA to calculate significance for main effects and 2FI interaction terms.',
      'Review interaction plots (crossed lines indicate strong synergy or antagonism).',
      'Check Lack of Fit test against pure error from center points (p > 0.05 indicates good model fit).',
      'Examine R^2 and Adjusted R^2 to prevent over-fitting interaction terms.'
    ],
    caseStudyLink: {
      whyThisDesignForThisCase: 'In the Fluid Bed Granulation study, 5 process parameters governed granule porosity and tablet dissolution. A 16-run Resolution V Fractional Factorial (2^(5-1)) was selected because it cleanly isolated the Spray Rate x Atomization Pressure interaction without confounding, allowing the team to establish dissolution-safe operating limits.',
      whatWouldGoWrongWithPoorerChoice: 'A Plackett-Burman screen would have aliased the Spray Rate x Pressure interaction with other variables, falsely attributing granule friability failures to inlet air temperature and leading to incorrect equipment specifications.'
    }
  },

  // ------------------------------------------------------------
  // 3. Taguchi Orthogonal Arrays
  // ------------------------------------------------------------
  taguchi: {
    id: 'taguchi',
    whyChoose: [
      'Explicitly focuses on process robustness: minimizing product variability caused by uncontrollable noise.',
      'Uses Signal-to-Noise (S/N) ratios to find factor setpoints that make quality immune to raw material lot changes.',
      'Accommodates mixed factor levels (e.g. Some factors at 2 levels, others at 3 levels) in compact fixed arrays.',
      'Ideal for commercial manufacturing transfer where raw material variability cannot be eliminated economically.',
      'Supports ICH Q8(R2) / ICH Q9 principles of building quality into the process through robust parameter design.'
    ],
    chooseWhen: [
      { condition: 'Process is subject to uncontrollable noise factors (ambient humidity, excipient supplier variability, operator technique).' },
      { condition: 'Factors have mixed levels (e.g., two 2-level factors and four 3-level factors in an L18 array).' },
      { condition: 'Goal is robustness and variation reduction rather than maximum mathematical response surface modeling.' },
      { condition: 'Fixed, standardized orthogonal arrays (L8, L9, L12, L16, L18) are preferred by site standard operating procedures.' }
    ],
    avoidWhen: [
      {
        condition: 'High-precision mathematical response surface contours and quadratic sweet spots are required.',
        recommendedAlternativeId: 'bbd',
        alternativeLabel: 'Box-Behnken (BBD)'
      },
      {
        condition: 'Factor interactions need detailed statistical ANOVA deconvolution and modeling.',
        recommendedAlternativeId: 'fractional_factorial',
        alternativeLabel: 'Fractional Factorial (Res V)'
      },
      {
        condition: 'Formulation components sum to 100%.',
        recommendedAlternativeId: 'mixture',
        alternativeLabel: 'Mixture Design'
      },
      {
        condition: 'Number of runs must be strictly minimized for 4 to 8 continuous variables.',
        recommendedAlternativeId: 'dsd',
        alternativeLabel: 'Definitive Screening Design (DSD)'
      }
    ],
    howItWorks: 'Taguchi designs use standardized orthogonal arrays (designated L4 to L36) to assign control factors. In a full robust parameter design, an inner array of control factors is tested against an outer array of deliberately introduced noise factors (e.g. low vs high moisture excipients). The response variability is converted into a Signal-to-Noise (S/N) ratio to identify control factor setpoints where noise has minimal impact on quality.',
    modelAndEffects: {
      canEstimate: [
        'Main effects of control factors on mean response',
        'Main effects of control factors on Signal-to-Noise (S/N) ratio (process variance)',
        'Optimal robust operating setpoints'
      ],
      cannotEstimate: [
        'Complex two-factor interactions without confounding in standard arrays',
        'Full quadratic response surfaces with true curvature contours'
      ],
      modelEquation: 'S/N = -10 * log10((1/n) * sum(1 / Y_i^2)) [for Larger-is-Better] or -10 * log10(s^2) [for Nominal-is-Best]',
      modelEquationExplanation: 'Instead of modeling Y directly, Taguchi models the Signal-to-Noise (S/N) ratio, transforming raw readings into a single metric representing mean performance divided by variance.'
    },
    aliasingAndResolution: {
      resolutionLevel: 'Resolution III (in standard unassigned arrays)',
      confoundingExplanation: 'Standard Taguchi arrays (like L8, L9, L12) deliberately sacrifice interaction degrees of freedom to maximize factor capacity. Interactions are confounded across main effect columns unless dedicated interaction columns are assigned via linear graphs.',
      practicalMeaning: 'Control factor main effects can be distorted if large interactions exist between factors placed in unmonitored columns.'
    },
    runCountLogic: {
      formula: 'Pre-defined fixed arrays: L8 (8 runs), L9 (9 runs), L12 (12 runs), L16 (16 runs), L18 (18 runs).',
      tableOrExamples: 'L8: up to 7 2-level factors | L9: up to 4 3-level factors | L12: up to 11 2-level factors | L18: mixed 2-level and 3-level factors (18 runs)',
      centerPointsGuidance: 'Center points are not standard in classic Taguchi arrays; 3-level arrays (L9, L18) evaluate midpoints directly.',
      replicatesGuidance: 'Repeated runs under different noise conditions (e.g. excipient lots) are essential to compute valid S/N ratios.'
    },
    assumptions: [
      'Noise factors cannot be controlled during routine commercial manufacturing, but can be controlled during the DoE.',
      'Control factors can be adjusted to desensitize the process against noise factors (cross-product interaction).',
      'The S/N ratio transformation accurately reflects the economic and quality loss function (Taguchi Loss Function).'
    ],
    strengths: [
      'Directly targets commercial batch-to-batch consistency and process capability (Cpk).',
      'Handles mixed factor levels (2-level and 3-level factors) very cleanly in arrays like L18.',
      'Standardized matrices that are simple for production floor operators and technicians to implement.',
      'Focuses on setting parameters at the flat region of the response curve where variability is lowest.'
    ],
    limitations: [
      'Interactions are often ignored or assumed negligible, which can mislead optimization if interactions are large.',
      'Statistical ANOVA testing is less rigorous compared to standard general linear modeling.',
      'Does not generate continuous response surface contours or sweet spot boundary equations.'
    ],
    chemistryExamples: [
      'Rotary tablet press: optimizing pre-compression force, main compression force, turret speed, and feeder paddle RPM against raw material bulk density noise.',
      'Liposome sterile filtration: optimizing membrane type, differential pressure, and flow rate against viscosity fluctuations.',
      'Coating pan operation: optimizing spray rate, atomizing air, and inlet airflow against seasonal relative humidity shifts.'
    ],
    qbdLink: {
      qbdWorkflowStage: 'Formulation / Process Robustness & Control Strategy',
      designSpaceRole: 'Validates that the Design Space is robust against raw material lot-to-lot variability (Critical Material Attributes - CMAs) and environmental drift.',
      ichGuidanceDetails: 'Aligns with ICH Q8(R2) Section 2.5 on process robustness, demonstrating that commercial manufacturing will consistently meet CQA specifications despite incoming noise.'
    },
    nextStep: 'Implement the optimal factor levels identified by the highest S/N ratio, conduct confirmation runs under worst-case noise conditions, and finalize the commercial batch control strategy.',
    commonMistakes: [
      'Not including realistic noise factors, reducing the Taguchi design to a weak screening experiment.',
      'Using the S/N ratio formula incorrectly (e.g. Applying Larger-is-Better to an impurity response).',
      'Overlooking large chemical interactions that contradict the Taguchi additivity assumption.'
    ],
    analysisTips: [
      'Analyze the response using two metrics: Mean (to hit target) and S/N Ratio (to minimize variation).',
      'Use Response Tables for S/N ratios to identify which factor has the largest delta impact on variability.',
      'Always run 3 to 5 confirmation batches at the predicted optimum to verify reproducibility.'
    ],
    caseStudyLink: {
      whyThisDesignForThisCase: 'In the Rotary Tablet Press study, tablet hardness and weight fluctuated wildly due to unavoidable excipient bulk density variation across raw material vendors. An L18 Taguchi design with raw material density as an outer noise factor identified specific setpoints for Compression Force and Feeder Speed that reduced tablet hardness RSD from 8.4% to 2.1%.',
      whatWouldGoWrongWithPoorerChoice: 'A conventional CCD design would have identified an operating point that yielded target hardness under idealized lab conditions, but would have continued to fail in commercial production whenever a new excipient lot arrived.'
    }
  },

  // ------------------------------------------------------------
  // 4. Definitive Screening Design (DSD)
  // ------------------------------------------------------------
  dsd: {
    id: 'dsd',
    whyChoose: [
      'Modern 3-level screening design that estimates all main effects completely free of confounding with 2FIs.',
      'Identifies non-linear curvature without requiring an expensive Response Surface Methodology (RSM) design.',
      'Highly economical: requires only 2k + 1 runs (e.g. 6 factors in 13 runs; 8 factors in 17 runs).',
      'Two-factor interactions are not aliased with main effects, preventing false positive signals.',
      'Often solves the entire optimization problem in a single experimental step if only 1 or 2 factors exhibit curvature.'
    ],
    chooseWhen: [
      { condition: 'Investigating 4 to 12 continuous factors (ideal for k = 5 to 9).' },
      { condition: 'Run budget is moderate (cannot afford 30+ runs of a CCD, but have more budget than PB).' },
      { condition: 'You strongly suspect curvature or a local optimum exists within the factor ranges.' },
      { condition: 'Goal is simultaneous screening and early response surface modeling.' },
      { condition: 'Factors are primarily continuous (temperature, time, pressure, pH, concentration).' }
    ],
    avoidWhen: [
      {
        condition: 'Investigating multiple categorical factors with 3 or more levels.',
        recommendedAlternativeId: 'd_optimal',
        alternativeLabel: 'D-Optimal Custom Design'
      },
      {
        condition: 'You only have 2 or 3 factors to study.',
        recommendedAlternativeId: 'full_factorial',
        alternativeLabel: 'Full Factorial / CCD'
      },
      {
        condition: 'Factors are formulation ingredients that must sum to 100%.',
        recommendedAlternativeId: 'mixture',
        alternativeLabel: 'Mixture Design'
      },
      {
        condition: 'Rigorous full quadratic response surface with complete 2FI estimation across all pairs is mandatory.',
        recommendedAlternativeId: 'ccd',
        alternativeLabel: 'Central Composite (CCD)'
      }
    ],
    howItWorks: 'Invented by Jones and Nachtsheim (2011), DSD uses conference matrices to create a 3-level design where factor levels (-1, 0, +1) are folded over in pairs. For every run, there is an exact mirror run with inverted signs, and each factor is set at its center point (0) exactly once per pair. This structure makes main effects strictly orthogonal to all 2-factor interactions and all quadratic effects.',
    modelAndEffects: {
      canEstimate: [
        'Linear main effects (beta_i) completely unconfounded with any 2FI',
        'Pure quadratic curvature effects (beta_ii) for all factors',
        'Sparse 2-factor interactions (beta_ij) using stepwise or forward model selection'
      ],
      cannotEstimate: [
        'A full quadratic model containing ALL possible 2-factor interactions simultaneously (degrees of freedom limit this)'
      ],
      modelEquation: 'Y = beta_0 + sum(beta_i * X_i) + sum(beta_ii * X_i^2) + sum_sparse(beta_ij * X_i * X_j) + epsilon',
      modelEquationExplanation: 'A curvature-capable quadratic model with main effects, quadratic terms, and statistically selected active interaction terms.'
    },
    aliasingAndResolution: {
      resolutionLevel: 'Curvature-Capable Resolution IV+',
      confoundingExplanation: 'Main effects are completely orthogonal to all 2-factor interactions and quadratic effects. Two-factor interactions are not aliased with each other completely (correlation coefficients typically 0.2 to 0.5), meaning they can be resolved using standard model selection.',
      practicalMeaning: 'You will never mistake a two-factor interaction or quadratic curve for a main effect. If Temperature is significant, it is genuinely significant.'
    },
    runCountLogic: {
      formula: 'N = 2k + 1 for even k, or 2k + 3 for odd k (standard practice adds 2 to 4 extra center runs for error estimation).',
      tableOrExamples: 'k=4: 9-11 runs | k=5: 13-15 runs | k=6: 13-15 runs | k=8: 17-19 runs | k=10: 21-25 runs',
      centerPointsGuidance: 'DSD inherently includes a center point in every run pair plus an overall center run; adding 2 extra center runs improves lack-of-fit testing.',
      replicatesGuidance: 'Add 2 to 4 replicate runs at the center or selected runs to establish pure error degrees of freedom for ANOVA.'
    },
    assumptions: [
      'Effect Sparsity: Only 2 to 3 factors will exhibit significant quadratic curvature or interactions.',
      'Inheritance Principle: Two-factor interactions typically occur between factors that also have active main effects.'
    ],
    strengths: [
      'Resolves the screening vs optimization dilemma in one compact matrix.',
      'Curvature detection built-in: avoids the need for an RSM in many development projects.',
      'Zero aliasing between main effects and 2FIs.',
      'Fewer runs than Fractional Factorials for k >= 6.'
    ],
    limitations: [
      'Cannot fit a full saturated 2FI model if many interactions are simultaneously active.',
      'Categorical factors with more than 2 levels degrade the conference matrix symmetry.',
      'Requires modern model selection algorithms (Forward Stepwise, Lasso, or All Subsets) for analysis.'
    ],
    chemistryExamples: [
      'Continuous microfluidic API synthesis: optimizing temperature, residence time, stoichiometry, catalyst mol%, solvent ratio, and quench delay.',
      'Tangential flow filtration (TFF): optimizing transmembrane pressure, crossflow rate, feed concentration, membrane area, and diafiltration volume.',
      'Polypeptide solid-phase peptide synthesis (SPPS): studying deprotection time, coupling temperature, reagent excess, wash cycles, and microwave power.'
    ],
    qbdLink: {
      qbdWorkflowStage: 'Screening ➔ Early Design Space',
      designSpaceRole: 'Frequently establishes the first draft of an ICH Q8 Design Space in continuous processes by estimating both linear and quadratic response boundaries.',
      ichGuidanceDetails: 'Exemplifies modern QbD efficiency by generating empirical response surfaces supporting Critical Process Parameter (CPP) designation in minimal runs.'
    },
    nextStep: 'If the DSD model fits well with high R^2 (> 0.85) and no lack of fit, proceed directly to defining the Design Space. If complex multi-factor interactions remain ambiguous, add 4 to 8 targeted augmentation runs.',
    commonMistakes: [
      'Using traditional backward elimination ANOVA that over-fits saturated terms; use Stepwise with AICc or BIC criteria instead.',
      'Adding too many 2-level categorical factors, which increases required runs.',
      'Treating factors with boundary optima as linear; DSD provides 3 levels precisely to detect interior peaks.'
    ],
    analysisTips: [
      'Use Forward Stepwise Regression with corrected Akaike Information Criterion (AICc) to select active terms.',
      'Confirm that quadratic terms (X_i^2) are retained only when physically reasonable.',
      'Plot 3D response surfaces and contour plots for the 2 to 3 most dominant factors.'
    ],
    caseStudyLink: {
      whyThisDesignForThisCase: 'In the Continuous Flow Microreactor study, an exothermic reaction suffered from thermal degradation in batch mode. 6 factors needed evaluation, and non-linear kinetics were expected. A 15-run DSD identified strong quadratic curvature in Temperature and a synergistic interaction between Residence Time and Catalyst concentration, achieving 99.4% conversion and saving over 40 experimental runs compared to classical CCD.',
      whatWouldGoWrongWithPoorerChoice: 'A Plackett-Burman screen would have completely missed the non-linear temperature peak (assuming reaction rate increases indefinitely with heat). A standard CCD would have required 52 runs, wasting precious flow reactor capacity and scarce reagents.'
    }
  },

  // ------------------------------------------------------------
  // 5. Full Factorial Design (2^k, 3^k)
  // ------------------------------------------------------------
  full_factorial: {
    id: 'full_factorial',
    whyChoose: [
      'The gold standard of experimental design: tests every possible combination of all factor levels.',
      'Zero aliasing or confounding: estimates all main effects, 2-way, 3-way, up to k-way interactions with absolute clarity.',
      'Provides maximum statistical power and highest degrees of freedom for error estimation.',
      'Unquestioned regulatory credibility for critical filing studies and commercial process validation.',
      'Essential when high-order chemical interactions (e.g. 3-way catalyst-solvent-substrate interaction) cannot be assumed zero.'
    ],
    chooseWhen: [
      { condition: 'Investigating 2 or 3 factors (at 2 or 3 levels each).' },
      { condition: 'Run budget can accommodate full combinations (4 to 16 runs for 2 levels; 9 to 27 runs for 3 levels).' },
      { condition: 'Critical regulatory submission study where no aliasing can be tolerated.' },
      { condition: 'Exploring complex multi-component catalysis or crystallization where 3-way interactions are plausible.' }
    ],
    avoidWhen: [
      {
        condition: 'Investigating 5 or more factors (run count explodes: 2^5 = 32 runs, 2^6 = 64 runs).',
        recommendedAlternativeId: 'fractional_factorial',
        alternativeLabel: 'Fractional Factorial / DSD'
      },
      {
        condition: 'High-throughput early-phase screening of many parameters.',
        recommendedAlternativeId: 'pb',
        alternativeLabel: 'Plackett-Burman (PB)'
      },
      {
        condition: 'Mapping full quadratic response surfaces for 3 to 5 factors without running 3^k combinations.',
        recommendedAlternativeId: 'bbd',
        alternativeLabel: 'Box-Behnken (BBD)'
      },
      {
        condition: 'Physical or safety constraints forbid testing extreme corner combinations.',
        recommendedAlternativeId: 'd_optimal',
        alternativeLabel: 'D-Optimal Design'
      }
    ],
    howItWorks: 'A full factorial design creates a complete Cartesian product grid of all factor levels. For k factors each at 2 levels, all 2^k corners of the multidimensional hypercube are tested. For 3 levels, all 3^k grid intersections are executed. Center points are typically added to assess repeatability and curvature.',
    modelAndEffects: {
      canEstimate: [
        'All linear main effects (beta_i)',
        'All 2-factor interactions (beta_ij)',
        'All higher-order interactions (beta_ijk through beta_12...k)',
        'Individual quadratic effects (beta_ii) if run as a 3-level (3^k) design'
      ],
      cannotEstimate: [
        'Quadratic curvature on a per-factor basis if run as a 2-level (2^k) design (only overall model curvature via center points)'
      ],
      modelEquation: 'Y = beta_0 + sum(beta_i * X_i) + sum(beta_ij * X_i * X_j) + ... + beta_12...k * X_1 * X_2 * ... * X_k + epsilon',
      modelEquationExplanation: 'The complete, unconstrained factorial polynomial containing every possible permutation of main effects and multi-way interactions.'
    },
    aliasingAndResolution: {
      resolutionLevel: 'Full Resolution (No Aliasing / Resolution Infinity)',
      confoundingExplanation: 'There is zero confounding. Every single effect and interaction degree of freedom is orthogonal and uniquely calculated.',
      practicalMeaning: 'What you calculate is what physically occurred. You have total certainty regarding interaction effects.'
    },
    runCountLogic: {
      formula: 'N = 2^k + C0 center points (for 2 levels) or 3^k (for 3 levels).',
      tableOrExamples: 'k=2: 4 runs (+ 3 center = 7 runs) | k=3: 8 runs (+ 3 center = 11 runs) | k=4: 16 runs (+ 4 center = 20 runs) | k=5: 32 runs',
      centerPointsGuidance: 'Add 3 to 4 center points to 2-level full factorials to test for curvature and compute pure experimental error.',
      replicatesGuidance: 'If experimental noise is high, duplicate the entire matrix or duplicate center points.'
    },
    assumptions: [
      'No assumptions of effect sparsity: all interactions are treated as potentially real and estimable.',
      'All factor combinations within the box are safe, physically feasible, and executable.'
    ],
    strengths: [
      'Definitive, unambiguous mathematical results with zero confounding.',
      'Directly measures high-order interactions that other designs ignore.',
      'Highest statistical power per factor of any experimental design.',
      'Extremely easy to interpret via standard ANOVA and main/interaction plots.'
    ],
    limitations: [
      'Exponential run explosion: impossible for large factor counts (e.g. 7 factors = 128 runs).',
      'Tests all extreme corner points simultaneously, which can cause process failure or safety hazards.',
      'Inefficient if effect sparsity holds and most interactions are zero.'
    ],
    chemistryExamples: [
      'Chiral salt crystallization: testing 3 factors (resolving agent molar ratio, seeding temperature, and cooling rate) at 2 levels + center points.',
      'Chromatographic purification: testing 2 factors (elution buffer pH and organic modifier concentration) to define peak resolution boundaries.',
      'Bioreactor seed inoculation: testing 3 factors (dissolved oxygen setpoint, initial cell density, and agitation speed) on cell viability.'
    ],
    qbdLink: {
      qbdWorkflowStage: 'Detailed Characterization ➔ Design Space Validation',
      designSpaceRole: 'Establishes the definitive regulatory Design Space and Normal Operating Ranges (NOR) for the vital few critical process parameters.',
      ichGuidanceDetails: 'Meets the highest standard of evidence under ICH Q8(R2) for proving the presence or absence of multi-factor interaction effects.'
    },
    nextStep: 'Calculate the composite desirability score across all CQAs, define the Normal Operating Ranges (NOR) well inside the Proven Acceptable Ranges (PAR), and draft the commercial control strategy.',
    commonMistakes: [
      'Attempting to run full factorials for 5 or more factors, running out of material or budget mid-campaign.',
      'Omitting center points in 2-level factorials, assuming the process response is linear between extremes.',
      'Running non-randomized blocks that introduce time-based analytical drift.'
    ],
    analysisTips: [
      'Examine the full ANOVA table; remove non-significant 3-way interactions to pool degrees of freedom into the error term.',
      'Generate interaction plots for all factor pairs to assess parallelism.',
      'Use contour and surface plots to visualize the response sweet spot.'
    ],
    caseStudyLink: {
      whyThisDesignForThisCase: 'In the Chiral Salt Crystallization case study, chiral purity and yield depended on three sensitive parameters. A full 2^3 factorial with 3 center points (11 runs) was the ideal choice because complete certainty regarding the 3-way interaction between resolving agent stoichiometry, seed temperature, and cooling rate was needed to prevent chiral inversion during commercial scale-up.',
      whatWouldGoWrongWithPoorerChoice: 'A screening design like Plackett-Burman would have completely aliased the multi-way seeding interactions, leading to unpredicted batch crystallization failures and out-of-specification optical purity at 1,000 L scale.'
    }
  },

  // ------------------------------------------------------------
  // 6. Box-Behnken Design (BBD)
  // ------------------------------------------------------------
  bbd: {
    id: 'bbd',
    whyChoose: [
      'Specifically avoids extreme corner combinations where simultaneous high/low settings cause process failure.',
      'Efficient 3-level response surface design: requires fewer runs than a Central Composite Design (CCD) for 3 or 4 factors.',
      'Only requires 3 levels per factor (-1, 0, +1), eliminating the need for extreme axial star points.',
      'Estimates full quadratic curvature and 2-factor interactions to locate the global sweet spot.',
      'Protects expensive reagents, delicate equipment, and prevents runaway reactions.'
    ],
    chooseWhen: [
      { condition: 'Investigating 3 to 5 continuous factors for response surface optimization.' },
      { condition: 'Simultaneous extreme high or low settings are hazardous, cause motor stall, or trigger decomposition.' },
      { condition: 'You cannot test beyond the safe operational box (extreme axial star points are physically impossible).' },
      { condition: 'You need full quadratic models (linear, 2FI, and squared terms) to establish an ICH Q8 Design Space.' }
    ],
    avoidWhen: [
      {
        condition: 'Investigating only 2 factors (BBD does not exist for k = 2; minimum k = 3).',
        recommendedAlternativeId: 'ccd',
        alternativeLabel: 'Central Composite Design (CCD)'
      },
      {
        condition: 'Predicting responses at the extreme corners of the factor cube is essential.',
        recommendedAlternativeId: 'ccd',
        alternativeLabel: 'Central Composite Design (CCD)'
      },
      {
        condition: 'Investigating more than 6 factors (run count becomes inefficient compared to DSD).',
        recommendedAlternativeId: 'dsd',
        alternativeLabel: 'Definitive Screening Design (DSD)'
      },
      {
        condition: 'Factors are formulation components summing to 100%.',
        recommendedAlternativeId: 'mixture',
        alternativeLabel: 'Mixture Design'
      }
    ],
    howItWorks: 'A Box-Behnken design combines fractional 2-level factorials with incomplete block designs. The experimental points are placed at the midpoints of the edges of the multidimensional factor cube and at the center. It completely avoids testing the vertices (corners) of the cube, forming a spherical design space inscribed inside the factor boundaries.',
    modelAndEffects: {
      canEstimate: [
        'Linear main effects (beta_i)',
        'Two-factor interactions (beta_ij)',
        'Pure quadratic curvature terms (beta_ii) for all factors',
        'Global optimum, ridges, and saddle points'
      ],
      cannotEstimate: [
        'Accurate predictions at the extreme corner vertices of the cuboidal region (high extrapolation variance)'
      ],
      modelEquation: 'Y = beta_0 + sum(beta_i * X_i) + sum(beta_ii * X_i^2) + sum(beta_ij * X_i * X_j) + epsilon',
      modelEquationExplanation: 'Full second-order response surface equation capturing linear trends, parabolic curvature (maxima/minima), and synergistic/antagonistic interactions.'
    },
    aliasingAndResolution: {
      resolutionLevel: 'Full Response Surface Quadratic Resolution',
      confoundingExplanation: 'All linear, squared, and interaction terms in the full quadratic model are estimable without confounding.',
      practicalMeaning: 'You can accurately fit 3D contour surfaces and multi-response desirability functions to find the optimal process setpoint.'
    },
    runCountLogic: {
      formula: 'N = 2k(k-1) + C0 center runs (e.g. k=3 -> 12 + 3 = 15 runs; k=4 -> 24 + 3 = 27 runs; k=5 -> 40 + 6 = 46 runs).',
      tableOrExamples: 'k=3: 15 runs (3 center pts) | k=4: 27 runs (3 center pts) | k=5: 46 runs (6 center pts)',
      centerPointsGuidance: 'Include 3 to 6 center points to maintain rotatability (near-uniform prediction variance) and estimate pure experimental error.',
      replicatesGuidance: 'Center points are replicated; edge points are typically run once unless assay variance is high.'
    },
    assumptions: [
      'The true optimum lies within the interior spherical region, not at the extreme outer corners.',
      'A second-order polynomial is sufficient to approximate the underlying physical/chemical response surface.'
    ],
    strengths: [
      'Safe: completely avoids combinations where all factors are at extreme limits simultaneously.',
      'Requires only 3 levels per factor (-1, 0, +1), simplifying physical equipment setup.',
      'More run-efficient than CCD for 3 factors (15 runs vs 20 runs).',
      'Rotatable or near-rotatable: spherical prediction variance profile.'
    ],
    limitations: [
      'Poor prediction accuracy at the corners of the experimental domain.',
      'Cannot be built sequentially from an existing 2^k factorial screening matrix (unlike CCD).',
      'Not mathematically possible for k = 2 factors.'
    ],
    chemistryExamples: [
      'High-shear wet granulation: optimizing impeller speed, chopper speed, water addition rate, and massing time without overloading the motor.',
      'Enzymatic esterification: studying enzyme loading, substrate ratio, temperature, and agitation rate without denaturing the biocatalyst.',
      'Spray drying of biologics: optimizing inlet temperature, feed flow rate, atomization pressure, and aspirator air flow.'
    ],
    qbdLink: {
      qbdWorkflowStage: 'Optimization ➔ Design Space Definition',
      designSpaceRole: 'The primary vehicle for constructing non-linear 3D Design Spaces and establishing Normal Operating Ranges (NOR) under ICH Q8(R2).',
      ichGuidanceDetails: 'Directly supports ICH Q8(R2) Section 2.4 formal Design Space submissions by modeling multi-criteria sweet spots and edge-of-failure boundaries.'
    },
    nextStep: 'Use numerical multi-criteria desirability functions to find the global optimum, overlay CQA contour plots to establish the sweet spot, and conduct 3 confirmation validation runs at the proposed setpoint.',
    commonMistakes: [
      'Trying to predict product quality at the extreme corner combinations where BBD prediction variance is very high.',
      'Using BBD when 5 factor levels are readily available and corner information is critical (CCD is better).',
      'Setting center points to zero without running enough center replicates to achieve rotatability.'
    ],
    analysisTips: [
      'Check ANOVA model p-value (p < 0.001) and Lack of Fit test (p > 0.05).',
      'Verify Adjusted R^2 and Predicted R^2 are within 0.20 of each other.',
      'Generate 3D surface and 2D contour plots with sweet spot overlays.'
    ],
    caseStudyLink: {
      whyThisDesignForThisCase: 'In the High-Shear Wet Granulation study, high impeller speed combined with high water addition and long massing time caused severe overwetting and motor stall. A 27-run Box-Behnken design was chosen specifically because it never tests all factors at high levels simultaneously, allowing the team to map non-linear granule growth without triggering equipment failure.',
      whatWouldGoWrongWithPoorerChoice: 'A Central Composite Design or Full Factorial would have forced runs at the high-impeller / high-water / long-time corner, resulting in motor burnout, ruined batches, and lost campaign time.'
    }
  },

  // ------------------------------------------------------------
  // 7. Central Composite Design (CCD)
  // ------------------------------------------------------------
  ccd: {
    id: 'ccd',
    whyChoose: [
      'The industry gold standard Response Surface Methodology (RSM) design for regulatory drug substance and product filings.',
      'Can be built sequentially: start with a 2-level factorial screening matrix, then augment with axial star points if curvature is detected.',
      'Offers two flexible geometry options: Face-Centered (alpha = 1.0, stays inside the box) and Rotatable (alpha > 1, uniform spherical variance).',
      'Provides exceptional prediction accuracy across the entire experimental volume, including corner regions.',
      'Enables definitive multidimensional sweet spot and edge-of-failure mapping for ICH Q8 regulatory dossiers.'
    ],
    chooseWhen: [
      { condition: 'Investigating 2 to 6 continuous factors for full quadratic optimization.' },
      { condition: 'You already ran a 2^k factorial screening study and need to augment it to model curvature.' },
      { condition: 'Building a formal regulatory Design Space for an NDA/MAA dossier.' },
      { condition: 'Prediction accuracy across both center and outer regions is required.' }
    ],
    avoidWhen: [
      {
        condition: 'Investigating 7 or more factors (run counts become prohibitive; > 80 runs).',
        recommendedAlternativeId: 'dsd',
        alternativeLabel: 'Definitive Screening Design (DSD)'
      },
      {
        condition: 'Simultaneous extreme high/low factor combinations are hazardous and must be strictly avoided.',
        recommendedAlternativeId: 'bbd',
        alternativeLabel: 'Box-Behnken (BBD)'
      },
      {
        condition: 'Factors are formulation components summing to 100%.',
        recommendedAlternativeId: 'mixture',
        alternativeLabel: 'Mixture Design'
      },
      {
        condition: 'The experimental space has irregular or non-cuboidal constraints.',
        recommendedAlternativeId: 'd_optimal',
        alternativeLabel: 'D-Optimal Design'
      }
    ],
    howItWorks: 'A Central Composite Design consists of three distinct parts: (1) a two-level factorial cube (2^k points), (2) axial or star points placed at a distance alpha from the center along each factor axis, and (3) center points. In Face-Centered CCD (CCF), alpha = 1.0, so star points lie on the faces of the cube (requiring only 3 levels). In Rotatable CCD, alpha = (2^k)^(1/4), giving perfectly uniform prediction variance in all directions.',
    modelAndEffects: {
      canEstimate: [
        'Linear main effects (beta_i)',
        'Two-factor interactions (beta_ij)',
        'Pure quadratic curvature terms (beta_ii)',
        'Complete second-order response surface topography'
      ],
      cannotEstimate: [
        'Cubic or higher-order non-linear terms (unless augmented further)'
      ],
      modelEquation: 'Y = beta_0 + sum(beta_i * X_i) + sum(beta_ii * X_i^2) + sum(beta_ij * X_i * X_j) + epsilon',
      modelEquationExplanation: 'Full quadratic second-order model capturing linear gradients, multi-factor interactions, and directional curvature.'
    },
    aliasingAndResolution: {
      resolutionLevel: 'Full Response Surface Quadratic Resolution',
      confoundingExplanation: 'Zero confounding among any linear, interaction, or quadratic terms. Every parameter in the second-order model is uniquely estimated.',
      practicalMeaning: 'Yields the highest mathematical certainty for contour mapping and identifying critical edges of failure.'
    },
    runCountLogic: {
      formula: 'N = 2^k (cube) + 2k (star) + C0 (center). e.g. k=2 -> 4 + 4 + 5 = 13 runs; k=3 -> 8 + 6 + 6 = 20 runs; k=4 -> 16 + 8 + 6 = 30 runs; k=5 -> 32 + 10 + 10 = 52 runs.',
      tableOrExamples: 'k=2: 13 runs | k=3: 20 runs (6 center pts) | k=4: 30 runs (6 center pts) | k=5: 52 runs',
      centerPointsGuidance: 'Use 5 to 6 center points to achieve uniform precision and rotatability.',
      replicatesGuidance: 'Center points provide pure error estimation; full matrix replicates are rarely needed.'
    },
    assumptions: [
      'The response surface can be represented by a smooth parabolic quadratic function within the factor bounds.',
      'In rotatable CCD, testing at alpha > 1 does not violate equipment or safety limits.'
    ],
    strengths: [
      'Seamless sequential workflow: convert existing factorial screening directly into an RSM.',
      'Face-Centered option stays strictly within safe operating box using only 3 levels.',
      'Rotatable option provides uniform prediction variance at all points equidistant from the center.',
      'Unsurpassed regulatory acceptance across FDA, EMA, and PMDA.'
    ],
    limitations: [
      'Rotatable CCD requires 5 levels per factor (-alpha, -1, 0, +1, +alpha), which can be difficult to set up on fixed equipment.',
      'Tests corner points, which can be problematic if extreme combinations cause process failure.',
      'Inefficient for k >= 6 factors.'
    ],
    chemistryExamples: [
      'Biopharmaceutical lyophilization: optimizing primary drying shelf temperature, chamber pressure, and ramp rate to prevent cake collapse.',
      'Continuous crystallizer: optimizing residence time, supersaturation ratio, and seed surface area on polymorphic purity.',
      'Nanoparticle wet bead milling: studying tip speed, bead charge ratio, slurry flow rate, and milling time on particle size reduction.'
    ],
    qbdLink: {
      qbdWorkflowStage: 'Optimization ➔ Regulatory Design Space Submission',
      designSpaceRole: 'The benchmark design for establishing the formal multidimensional Design Space and Normal Operating Ranges (NOR) in Module 3 (Quality) of regulatory dossiers.',
      ichGuidanceDetails: 'Explicitly referenced in ICH Q8(R2) Annex 1 examples for demonstrating robust process understanding and setting regulatory control strategies.'
    },
    nextStep: 'Overlay all CQA specification boundaries to define the final multidimensional Design Space, verify the model with 3 confirmation verification runs, and submit as the commercial operational envelope.',
    commonMistakes: [
      'Using Rotatable CCD when factor ranges cannot physically exceed the box boundaries (use Face-Centered instead).',
      'Running all runs in one non-randomized batch instead of taking advantage of the sequential 2-stage structure.',
      'Not running enough center points, which ruins rotatability.'
    ],
    analysisTips: [
      'Verify that the Lack of Fit test is non-significant (p > 0.05).',
      'Use Derringer-Suich composite desirability functions to balance competing CQAs (e.g. Yield vs Impurities).',
      'Perform Monte Carlo tolerance analysis across the Design Space to calculate the defect probability.'
    ],
    caseStudyLink: {
      whyThisDesignForThisCase: 'In the Biopharmaceutical Lyophilization case study, cake collapse and residual moisture were governed by shelf temperature and vacuum pressure. A 20-run Face-Centered CCD mapped the sublimation sublimation boundary without exceeding equipment refrigeration limits, establishing an FDA-approved 3D Design Space with validated Normal Operating Ranges (NOR).',
      whatWouldGoWrongWithPoorerChoice: 'A screening design would have failed to model the curved sublimation rate boundary, risking catastrophic batch cake collapse during commercial manufacturing.'
    }
  },

  // ------------------------------------------------------------
  // 8. Mixture Design (Simplex Centroid & Simplex Lattice)
  // ------------------------------------------------------------
  mixture: {
    id: 'mixture',
    whyChoose: [
      'Specifically engineered for formulation development where components must sum to 100% (or 1.0).',
      'Standard factorial designs fail on mixtures because increasing one component inherently dilutes the others.',
      'Accurately models non-linear blending synergies (e.g. Co-solvents dissolving API better together than either pure solvent).',
      'Identifies ternary and quaternary eutectic mixtures, optimal surfactant-lipid ratios, and excipient matrices.',
      'Generates triangular ternary contour plots that form the foundation of formulation QbD dossiers.'
    ],
    chooseWhen: [
      { condition: 'Factors are ingredients or components whose proportions sum to a constant (e.g., sum of X_i = 100% or 1.0).' },
      { condition: 'Formulating lipid nanoparticles (LNPs), tablet binder/filler blends, creams, or co-solvent systems.' },
      { condition: 'Investigating 3 to 6 components (q = 3 to 6).' },
      { condition: 'Individual components have lower and/or upper bound constraints (pseudo-component transformations).' }
    ],
    avoidWhen: [
      {
        condition: 'Factors are independent process parameters (temperature, pressure, agitation, time).',
        recommendedAlternativeId: 'bbd',
        alternativeLabel: 'Box-Behnken (BBD)'
      },
      {
        condition: 'Investigating both mixture components AND process parameters simultaneously.',
        recommendedAlternativeId: 'd_optimal',
        alternativeLabel: 'Combined Mixture-Process D-Optimal'
      },
      {
        condition: 'Only 2 components exist (a simple 1D binary titration curve is sufficient).',
        recommendedAlternativeId: 'full_factorial',
        alternativeLabel: 'Factorial / Line Sweep'
      }
    ],
    howItWorks: 'Mixture designs operate on a simplex coordinate system (a triangle for 3 components, a tetrahedron for 4). A Simplex Centroid design tests pure components (vertices), binary 50:50 blends (edge midpoints), ternary 1/3:1/3:1/3 blends (face centroids), and an overall centroid. Special Scheffé polynomial models are used that exclude the intercept beta_0 to account for the mathematical dependency sum(X_i) = 1.',
    modelAndEffects: {
      canEstimate: [
        'Pure component linear blending values (beta_i)',
        'Binary synergistic and antagonistic blending interactions (beta_ij)',
        'Ternary blending effects (beta_ijk)',
        'Non-linear formulation sweet spots'
      ],
      cannotEstimate: [
        'Standard independent factor main effects (since factors are mathematically interdependent)'
      ],
      modelEquation: 'Y = sum(beta_i * X_i) + sum(beta_ij * X_i * X_j) + sum(beta_ijk * X_i * X_j * X_k) + epsilon',
      modelEquationExplanation: 'Scheffé canonical polynomial: no intercept term (beta_0 is omitted because sum of X_i = 1); beta_ij represents excess synergistic/antagonistic blending beyond linear addition.'
    },
    aliasingAndResolution: {
      resolutionLevel: 'Mixture Surface Canonical Resolution',
      confoundingExplanation: 'Standard orthogonality does not apply because of the mixture constraint. Parameters are estimated using Scheffé canonical forms where linear and cross-product terms are unconfounded within the simplex geometry.',
      practicalMeaning: 'You can directly evaluate whether combining Excipient A and Excipient B creates a synergistic boost in drug solubility.'
    },
    runCountLogic: {
      formula: 'Simplex Centroid: N = 2^q - 1 + C0 center replicates (e.g. q=3 -> 7 blend runs + 3 replicates = 10 runs; q=4 -> 15 runs + 3 replicates = 18 runs).',
      tableOrExamples: 'q=3: 10 runs (with replicates) | q=4: 15-18 runs | q=5: 31-36 runs',
      centerPointsGuidance: 'Replicate the overall centroid (1/q, 1/q, ..., 1/q) 3 to 5 times to assess formulation repeatability and pure error.',
      replicatesGuidance: 'Replicating pure component vertices and centroid is critical to capture formulation preparation variability.'
    },
    assumptions: [
      'The response depends entirely on the relative proportions of the ingredients, not on the total volume/mass of the batch.',
      'Components sum exactly to 1.0 (or 100%).'
    ],
    strengths: [
      'The only mathematically valid design for true formulation and blending problems.',
      'Detects synergistic co-solvency and solubilization effects that standard DoE misses.',
      'Produces intuitive ternary contour diagrams for formulation team decision-making.',
      'Supports pseudo-components when ingredients have minimum or maximum constraints.'
    ],
    limitations: [
      'Cannot directly include process parameters (like temperature or mix time) without expanding to combined crossed designs.',
      'Run count increases rapidly for q >= 6 components.',
      'Standard linear regression software without Scheffé models will produce invalid results due to multicollinearity.'
    ],
    chemistryExamples: [
      'mRNA Lipid Nanoparticles (LNPs): optimizing the molar ratio of Ionizable Lipid, Phospholipid (DOPE), Cholesterol, and PEG-lipid.',
      'Topical gel formulation: optimizing ratios of water, ethanol, propylene glycol, and gelling polymer.',
      'Direct compression tablet: optimizing proportions of microcrystalline cellulose, lactose, disintegrant, and lubricant.'
    ],
    qbdLink: {
      qbdWorkflowStage: 'Formulation Development ➔ Formulation Design Space',
      designSpaceRole: 'Establishes the commercial formulation composition boundaries (Critical Material Attributes - CMAs) required under ICH Q8(R2) Section 2.2.',
      ichGuidanceDetails: 'Directly aligns with ICH Q8(R2) formulation composition requirements for proving that excipient variability remains within the quality window.'
    },
    nextStep: 'Select the optimal mixture ratio, fix the formulation composition, and transition to a process DoE (CCD or Box-Behnken) to optimize manufacturing parameters (e.g. Microfluidic flow rates, temperatures).'
    ,
    commonMistakes: [
      'Analyzing a mixture experiment using standard factorial regression models with an intercept, leading to singular matrix errors.',
      'Not applying pseudo-component transformations when components cannot range from 0 to 100%.',
      'Ignoring viscosity or physical phase separation boundaries during run planning.'
    ],
    analysisTips: [
      'Use Cox direction sweeps or trace plots to see how changing one ingredient relative to the remaining blend affects the CQA.',
      'Generate ternary contour diagrams showing sweet spot overlays for all CQAs.',
      'Ensure the model equation uses Scheffé canonical form without an intercept.'
    ],
    caseStudyLink: {
      whyThisDesignForThisCase: 'In the mRNA Lipid Nanoparticle (LNP) case study, encapsulation efficiency and particle size depended on the 4-component lipid ratio. A 15-run Simplex Centroid mixture design identified a critical synergistic ratio between Ionizable Lipid and Cholesterol that achieved 97.2% encapsulation efficiency with PDI < 0.08.',
      whatWouldGoWrongWithPoorerChoice: 'Using a standard factorial design would have generated runs that did not sum to 100% lipid content, resulting in varying total lipid concentration, precipitation, and completely uninterpretable delivery data.'
    }
  },

  // ------------------------------------------------------------
  // 9. D-Optimal & I-Optimal Design
  // ------------------------------------------------------------
  d_optimal: {
    id: 'd_optimal',
    whyChoose: [
      'Maximum flexibility: solves irregular, non-standard, or physically constrained experimental spaces where standard DoEs cannot run.',
      'Handles severe safety constraints (e.g. Preventing dangerous exothermic reaction zones: Temp x Conc < Threshold).',
      'Handles mixed factor types seamlessly: continuous, multi-level categorical, and formulation mixture components in one matrix.',
      'Custom run budgets: can fit any user-specified number of runs (e.g. Exactly 18 runs based on vial availability).',
      'Uses algorithmic optimization to maximize statistical information (D-Optimal maximizes determinant |X^T X|).'
    ],
    chooseWhen: [
      { condition: 'Experimental space has forbidden combinations (safety, physical precipitation, or equipment limits).' },
      { condition: 'Mixing continuous factors with multi-level categorical factors (e.g., 3 catalyst types and 4 solvent types).' },
      { condition: 'Experimental run budget is fixed by resources (e.g., only 20 pre-packed chromatography columns available).' },
      { condition: 'Augmenting an existing historical dataset with additional informative runs.' }
    ],
    avoidWhen: [
      {
        condition: 'The experimental space is a standard unconstrained cuboidal box with continuous factors.',
        recommendedAlternativeId: 'bbd',
        alternativeLabel: 'Box-Behnken (BBD) / CCD'
      },
      {
        condition: 'Standard orthogonal screening of 8+ continuous factors is required.',
        recommendedAlternativeId: 'pb',
        alternativeLabel: 'Plackett-Burman (PB)'
      },
      {
        condition: 'Simple 3-level screening with built-in curvature detection is sufficient.',
        recommendedAlternativeId: 'dsd',
        alternativeLabel: 'Definitive Screening Design (DSD)'
      }
    ],
    howItWorks: 'Instead of using fixed geometric patterns, computer exchange algorithms (Coordinate Exchange, Fedorov) evaluate thousands of candidate points and select the subset that maximizes the determinant of the information matrix |X^T X| (D-Optimal: minimizes parameter variance) or minimizes the average prediction variance across the space (I-Optimal).',
    modelAndEffects: {
      canEstimate: [
        'Specified model terms (linear, 2FI, quadratic, or categorical effects)',
        'Custom user-defined model equations',
        'Complex multi-level categorical contrasts'
      ],
      cannotEstimate: [
        'Model terms not specified in the initial algorithmic candidate setup'
      ],
      modelEquation: 'Y = X * beta + epsilon (Custom user-specified linear, interaction, or quadratic structure)',
      modelEquationExplanation: 'Tailored specifically to the model terms chosen by the user prior to algorithmic generation.'
    },
    aliasingAndResolution: {
      resolutionLevel: 'Custom Algorithmic Resolution',
      confoundingExplanation: 'D-optimal designs are rarely perfectly orthogonal due to boundary constraints, but the algorithm minimizes covariance between all model terms.',
      practicalMeaning: 'Small non-zero correlations between factors exist, but variance inflation factors (VIF) are kept strictly under control (< 5).'
    },
    runCountLogic: {
      formula: 'User-specified run budget N >= p (where p is number of model parameters; recommended N = 1.5p to 2p for pure error).',
      tableOrExamples: 'k=3 (constrained): 16-18 runs | k=4 (with exclusions): 22-26 runs | k=5 (mixed types): 28-34 runs',
      centerPointsGuidance: 'Add 3 to 5 replicate points at interior locations to establish pure error degrees of freedom.',
      replicatesGuidance: 'D-optimal algorithms can be instructed to include replicated design points automatically.'
    },
    assumptions: [
      'The specified mathematical model is appropriate for the system (D-optimality is model-dependent).',
      'The defined constraint boundaries accurately reflect the physical/safety limitations of the process.'
    ],
    strengths: [
      'Accommodates any complex constraint, safety boundary, or forbidden zone.',
      'Handles categorical variables with 3, 4, or more levels with ease.',
      'Fits any exact run budget available to the chemist.',
      'Can rescue or augment existing incomplete or unbalanced datasets.'
    ],
    limitations: [
      'Model-dependent: if you generate a D-optimal design for a linear model, it cannot fit a quadratic curve later.',
      'Not orthogonal: slight correlations exist between factors.',
      'Requires statistical software to generate and analyze; cannot be constructed by hand.'
    ],
    chemistryExamples: [
      'API Grignard synthesis: temperature and concentration constrained by calorimeter runaway safety limits (T x Conc < safety margin).',
      'Catalyst & ligand screening: testing 4 distinct phosphine ligands, 3 bases, and continuous temperature/time.',
      'Chromatographic purification: column loading constrained by solubility limits across varying mobile phase pH.'
    ],
    qbdLink: {
      qbdWorkflowStage: 'Constrained Optimization ➔ Non-standard Design Space',
      designSpaceRole: 'The primary method for establishing irregular, non-cuboidal Design Spaces under ICH Q8(R2) when physical constraints forbid rectangular boundaries.',
      ichGuidanceDetails: 'Directly supports ICH Q8(R2) Section 2.4 where regulatory authorities allow complex non-linear mathematical boundaries defining the Proven Acceptable Ranges.'
    },
    nextStep: 'Fit the specified model, evaluate Lack of Fit, inspect Variance Inflation Factors (VIF < 5), and generate contour maps of the constrained safe operating region.',
    commonMistakes: [
      'Specifying a purely linear model during generation, then trying to fit quadratic curvature later.',
      'Setting the run count equal to the minimum parameter count (N = p), leaving zero degrees of freedom for error.',
      'Defining overly restrictive constraints that collapse the design space into a narrow sliver.'
    ],
    analysisTips: [
      'Inspect the Fraction of Design Space (FDS) plot to verify uniform prediction variance.',
      'Check Variance Inflation Factors (VIF) to confirm multicollinearity is acceptable (< 5).',
      'Use I-optimality instead of D-optimality if the primary goal is predicting responses rather than identifying parameter coefficients.'
    ],
    caseStudyLink: {
      whyThisDesignForThisCase: 'In the API Grignard study, combinations of temperature > 65°C and reagent concentration > 2.0 M triggered dangerous thermal runaways in safety calorimeter tests. A 22-run D-Optimal design incorporating a strict triangular safety exclusion zone mapped the safe operational envelope, enabling 94% yield while maintaining a minimum 35°C thermal safety margin.',
      whatWouldGoWrongWithPoorerChoice: 'A standard CCD or Box-Behnken would have forced experiments into the dangerous runaway zone, triggering a reactor rupture or shutdown, or would have forced the chemist to artificially shrink factor ranges to an overly conservative box.'
    }
  },

  // ------------------------------------------------------------
  // 10. Bayesian Adaptive Sequential Optimization (GP)
  // ------------------------------------------------------------
  bayesian_gp: {
    id: 'bayesian_gp',
    whyChoose: [
      'Active learning: executes 1 or 2 experiments at a time, learning from every result before picking the next run.',
      'Drastically reduces total experiments required to reach the global optimum (often saves 60-75% of runs).',
      'Ideal when experiments are extremely expensive, slow, or consume scarce material (e.g. $8,000/g biocatalysts, scarce bioprocess broth).',
      'Non-parametric Gaussian Process modeling captures complex, multi-modal, or highly non-linear response surfaces that polynomials fail to fit.',
      'Balances exploitation (optimizing known high-performing areas) with exploration (testing uncharted regions with high uncertainty).'
    ],
    chooseWhen: [
      { condition: 'Experiments are executed sequentially (one or two at a time) rather than in parallel batches.' },
      { condition: 'Each experimental run is very costly (scarce materials, long turnaround, expensive analytical assays).' },
      { condition: 'Initial DoE / RSM showed moderate desirability and needs targeted refinement.' },
      { condition: 'The response surface is suspected to be non-polynomial or multimodal (multiple local peaks).' },
      { condition: 'Investigating 2 to 8 continuous factors.' }
    ],
    avoidWhen: [
      {
        condition: 'Experiments must be executed in a single high-throughput parallel batch (e.g., 96-well plate or multi-vessel station).',
        recommendedAlternativeId: 'dsd',
        alternativeLabel: 'Definitive Screening Design (DSD)'
      },
      {
        condition: 'The regulatory filing requires a simple, transparent classical ANOVA polynomial equation.',
        recommendedAlternativeId: 'ccd',
        alternativeLabel: 'Central Composite Design (CCD)'
      },
      {
        condition: 'Large-scale early screening of 10+ factors is required.',
        recommendedAlternativeId: 'pb',
        alternativeLabel: 'Plackett-Burman (PB)'
      }
    ],
    howItWorks: 'Bayesian Optimization builds a non-parametric Gaussian Process (GP) surrogate model over existing data. The GP predicts both an expected outcome (mean mu(x)) and an uncertainty (variance sigma(x)) for every untested point in the space. An acquisition function—such as Expected Improvement (EI)—scores untested candidates, selecting the exact next setpoint that offers the highest probability of improving over the current best result.',
    modelAndEffects: {
      canEstimate: [
        'Non-parametric response surfaces of arbitrary complexity',
        'Point-by-point prediction mean (mu) and 95% confidence interval uncertainty bounds (sigma)',
        'Global optimum location and Pareto frontiers for multi-objective optimization'
      ],
      cannotEstimate: [
        'Classical fixed polynomial coefficients (beta_i, beta_ij) or standard ANOVA tables'
      ],
      modelEquation: 'Y(x) ~ GP(m(x), k(x, x\')) where k is a Matern 5/2 or RBF covariance kernel',
      modelEquationExplanation: 'A non-parametric Bayesian probability distribution over functions defined by a prior mean and a covariance kernel capturing spatial correlation.'
    },
    aliasingAndResolution: {
      resolutionLevel: 'Non-Parametric Bayesian Resolution',
      confoundingExplanation: 'Classical aliasing concepts do not apply. Instead, the model maintains a continuous uncertainty surface (sigma(x)) across the space. Unexplored regions naturally have high uncertainty, preventing the algorithm from jumping to premature conclusions.',
      practicalMeaning: 'The algorithm will never be fooled by false interactions because it explicitly measures model uncertainty and explores sparse zones.'
    },
    runCountLogic: {
      formula: 'N_initial = 5 to 10 exploratory runs (Sobol / Latin Hypercube), followed by 1 to 2 adaptive runs per iteration until convergence.',
      tableOrExamples: 'Initial batch: 6 runs | Adaptive iterations: 6-10 single runs | Total: 12-16 runs',
      centerPointsGuidance: 'Replicates at key operating setpoints can be included to estimate analytical measurement noise variance (nugget parameter).',
      replicatesGuidance: 'The GP kernel naturally incorporates measurement noise without requiring rigid replicate structures.'
    },
    assumptions: [
      'The response function is smooth and continuous (governed by the chosen covariance kernel like Matern 5/2).',
      'The sequential turnaround time allows updating the model between runs.'
    ],
    strengths: [
      'Maximum sample efficiency: finds global optimum in fewer runs than any classical design.',
      'Does not assume a rigid quadratic polynomial shape; models complex real-world kinetics.',
      'Exploration vs Exploitation balance avoids getting trapped in suboptimal local peaks.',
      'Provides true 95% confidence intervals across the entire parameter space.'
    ],
    limitations: [
      'Requires sequential workflow; unsuited for high-throughput parallel plate automation.',
      'Black-box mathematical nature: harder to present to conservative regulatory auditors who prefer simple polynomial equations.',
      'Computational overhead increases with hundreds of data points (not an issue for typical chemistry campaigns).'
    ],
    chemistryExamples: [
      'Enzymatic biocatalysis: optimizing enzyme loading, PLP cofactor, temperature, and donor stoichiometry with an expensive $8,000/g engineered transaminase.',
      'Fermentation bioreactor feeding: sequential optimization of nutrient feed rate, induction optical density, and post-induction temperature.',
      'Photocatalytic C-H activation: sequential optimization of light intensity, catalyst loading, photocatalyst concentration, and residence time.'
    ],
    qbdLink: {
      qbdWorkflowStage: 'Adaptive Optimization ➔ Design Space Verification',
      designSpaceRole: 'Rapidly converges on the verified sweet spot and defines the high-probability region of achieving CQA acceptance criteria.',
      ichGuidanceDetails: 'Aligns with modern ICH Q8(R2) / ICH Q12 lifecycle approaches that encourage advanced predictive machine learning tools for continuous process optimization.'
    },
    nextStep: 'Once the acquisition function converges (Expected Improvement < threshold), perform 3 validation runs at the proposed optimum, verify the 95% confidence intervals, and lock the commercial operating range.',
    commonMistakes: [
      'Setting the acquisition function to pure exploitation (exploration weight xi = 0), getting trapped in a mediocre local peak.',
      'Using Bayesian optimization for cheap, fast parallel experiments where classical DoE is more practical.',
      'Stopping after only 2 adaptive iterations before the algorithm has explored uncertain zones.'
    ],
    analysisTips: [
      'Plot Expected Improvement (EI) versus iterations to monitor convergence.',
      'Inspect 2D cross-section contour plots showing both predicted mean and prediction uncertainty (standard error).',
      'Validate model fit by plotting predicted values versus observed values with error bars.'
    ],
    caseStudyLink: {
      whyThisDesignForThisCase: 'In the Enzymatic Biocatalysis case study, an engineered transaminase enzyme cost $8,000/g, making a standard 30-run CCD cost-prohibitive. Starting with a 6-run Sobol sequence, Bayesian optimization converged to the global optimum (99.8% ee, 42 g/L/day) in only 8 sequential iterations, reducing enzyme consumption by 72% compared to standard CCD.',
      whatWouldGoWrongWithPoorerChoice: 'A classical Central Composite Design would have consumed over $240,000 worth of enzyme and weeks of robotic preparation, whereas Bayesian optimization delivered an optimized process for a fraction of the cost.'
    }
  }
};
