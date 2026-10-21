// src/utils/projectUtils.ts
// Project Stage categorization and step mapping utilities for Viruj Chematrix

export type ProjectStage = 'planning' | 'ongoing' | 'completed';

/**
 * Classifies a project into one of the three workflow stages:
 * - Planning: Steps 1 – 7
 * - On-going: Steps 8 – 15
 * - Completed: Steps 16 – 17 or finished
 */
export function getProjectStage(currentStep: number, isFinished?: boolean): ProjectStage {
  if (isFinished || currentStep >= 16) return 'completed';
  if (currentStep >= 8) return 'ongoing';
  return 'planning';
}

export const STEP_KEY_TO_NUMBER: Record<string, number> = {
  'welcome': 1,
  'create-project': 1,
  'qtpp': 2,
  'cqa': 3,
  'route-mapping': 4,
  'risk-assessment': 5,
  'phase0-summary': 6,
  'campaign-dashboard': 7,
  'understand-process': 8,
  'define-factors': 8,
  'recommend-doe': 9,
  'generate-doe': 10,
  'lab-experiments': 10,
  'upload-results': 10,
  'initial-optimization': 11,
  'enough-data': 12,
  'more-improvement': 12,
  'gp-model': 13,
  'update-model': 13,
  'bayesian-opt': 14,
  'new-experiment': 15,
  'lab-new': 15,
  'final-optimum': 16,
  'report': 17,
};

export const STEP_NUMBER_TO_LABEL: Record<number, string> = {
  1: '01. Create Project',
  2: '02. QTPP Definition',
  3: '03. CQA Derivation',
  4: '04. Route Mapping',
  5: '05. Risk Assessment',
  6: '06. Phase 0 Summary',
  7: '07. Campaign Dashboard',
  8: '08. Factors & Responses',
  9: '09. Recommend DOE',
  10: '10. DOE Matrix & Results',
  11: '11. Initial Optimum',
  12: '12. Enough Data?',
  13: '13. GP Model',
  14: '14. Bayesian Optimization',
  15: '15. New Experiment',
  16: '16. Final Optimum',
  17: '17. Generate Report',
};

/**
 * Resolves any step value (string key, number, or undefined) to a 1..17 step number.
 */
export function getStepNumber(currentStep: string | number | undefined): number {
  if (typeof currentStep === 'number') {
    return Math.max(1, Math.min(17, currentStep));
  }
  if (!currentStep) return 1;
  return STEP_KEY_TO_NUMBER[currentStep] || 1;
}

/**
 * Returns human-readable label for a step key or number.
 */
export function getStepLabel(currentStep: string | number | undefined): string {
  const stepNum = getStepNumber(currentStep);
  return STEP_NUMBER_TO_LABEL[stepNum] || `Step ${stepNum}`;
}

export interface StageMeta {
  key: ProjectStage;
  title: string;
  stepRange: string;
  includedSteps: string;
  badgeClasses: string;
  icon: string;
  accentColor: string;
}

export const STAGE_META: Record<ProjectStage, StageMeta> = {
  planning: {
    key: 'planning',
    title: 'Planning',
    stepRange: 'Steps 1 – 7',
    includedSteps: 'Step 01 (Create Project) through Step 07 (Campaign Dashboard)',
    badgeClasses: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: '📋',
    accentColor: '#d97706'
  },
  ongoing: {
    key: 'ongoing',
    title: 'On-going',
    stepRange: 'Steps 8 – 15',
    includedSteps: 'Step 08 (Factors & Responses) through Step 15 (New Experiment / Bayesian Iterations)',
    badgeClasses: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: '🧪',
    accentColor: '#2563eb'
  },
  completed: {
    key: 'completed',
    title: 'Completed',
    stepRange: 'Steps 16 – 17',
    includedSteps: 'Step 16 (Final Optimum) and Step 17 (Generate Report)',
    badgeClasses: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: '✅',
    accentColor: '#059669'
  }
};
