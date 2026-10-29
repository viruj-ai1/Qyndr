// src/utils/projectUtils.ts
// Project Stage categorization and step mapping utilities for Viruj Chematrix

export type ProjectStage = 'planning' | 'ongoing' | 'completed';

/**
 * Classifies a project into one of the three workflow stages:
 * - Planning: Steps 1 – 6 or status === 'PLANNING'
 * - On-going: Steps 7 – 14 or status === 'ON-GOING' / 'ONGOING'
 * - Completed: Steps 15 – 16 or status === 'COMPLETED' or isFinished
 */
export function getProjectStage(
  currentStep: number,
  isFinished?: boolean,
  status?: string
): ProjectStage {
  const normStatus = (status || '').trim().toUpperCase();
  if (normStatus === 'COMPLETED' || isFinished || currentStep >= 15) return 'completed';
  if (normStatus === 'ON-GOING' || normStatus === 'ONGOING' || (currentStep >= 7 && currentStep <= 14)) return 'ongoing';
  if (normStatus === 'PLANNING' || currentStep <= 6) return 'planning';
  return currentStep >= 15 ? 'completed' : currentStep >= 7 ? 'ongoing' : 'planning';
}

export const STEP_KEY_TO_NUMBER: Record<string, number> = {
  'welcome': 1,
  'create-project': 1,
  'qtpp': 2,
  'cqa': 3,
  'route-mapping': 4,
  'risk-assessment': 5,
  'stage-campaign-matrix': 6,
  'phase0-summary': 6,
  'stage-overview': 6,
  'campaign-dashboard': 6,
  'understand-process': 7,
  'define-factors': 7,
  'recommend-doe': 8,
  'generate-doe': 9,
  'lab-experiments': 9,
  'upload-results': 9,
  'initial-optimization': 10,
  'statistical-analysis': 10,
  'enough-data': 11,
  'more-improvement': 11,
  'gp-model': 12,
  'update-model': 12,
  'bayesian-opt': 13,
  'new-experiment': 14,
  'lab-new': 14,
  'final-optimum': 15,
  'report': 16,
};

export const STEP_NUMBER_TO_LABEL: Record<number, string> = {
  1: '01. Create Project',
  2: '02. QTPP Definition',
  3: '03. CQA Derivation',
  4: '04. Route Mapping',
  5: '05. Risk Assessment',
  6: '06. Stage Campaign Matrix',
  7: '07. Define Factors & Responses',
  8: '08. Recommend DOE',
  9: '09. DOE Matrix & Results',
  10: '10. Initial Optimum',
  11: '11. Enough Data?',
  12: '12. GP Model',
  13: '13. Bayesian Optimization',
  14: '14. New Experiment',
  15: '15. Final Optimum',
  16: '16. Generate Report',
};

/**
 * Resolves any step value (string key, number, or undefined) to a 1..16 step number.
 */
export function getStepNumber(currentStep: string | number | undefined): number {
  if (typeof currentStep === 'number') {
    return Math.max(1, Math.min(16, currentStep));
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
  statusLabel: string;
  stepRange: string;
  subtitle: string;
  includedSteps: string;
  badgeClasses: string;
  icon: string;
  accentColor: string;
  bgLight: string;
  borderColor: string;
  textColor: string;
}

export const STAGE_META: Record<ProjectStage, StageMeta> = {
  planning: {
    key: 'planning',
    title: 'Planning',
    statusLabel: 'PLANNING',
    stepRange: 'Steps 1 – 6',
    subtitle: 'QbD Foundation & Scoping · Steps 1–6',
    includedSteps: 'Step 01 (Create Project) through Step 06 (Stage Campaign Matrix)',
    badgeClasses: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: '📋',
    accentColor: '#F59E0B',
    bgLight: '#FFFBEB',
    borderColor: '#FDE68A',
    textColor: '#B45309'
  },
  ongoing: {
    key: 'ongoing',
    title: 'On-going',
    statusLabel: 'ON-GOING',
    stepRange: 'Steps 7 – 14',
    subtitle: 'DoE Runs & Bayesian Loop · Steps 7–14',
    includedSteps: 'Step 07 (Define Factors & Responses) through Step 14 (New Experiment / Bayesian Iterations)',
    badgeClasses: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: '🧪',
    accentColor: '#2563EB',
    bgLight: '#EFF6FF',
    borderColor: '#BFDBFE',
    textColor: '#1D4ED8'
  },
  completed: {
    key: 'completed',
    title: 'Completed',
    statusLabel: 'COMPLETED',
    stepRange: 'Steps 15 – 16',
    subtitle: 'Optimum & Final Reports · Steps 15–16',
    includedSteps: 'Step 15 (Final Optimum) and Step 16 (Generate Report)',
    badgeClasses: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: '✅',
    accentColor: '#10B981',
    bgLight: '#ECFDF5',
    borderColor: '#A7F3D0',
    textColor: '#047857'
  }
};

/**
 * Formats a date string into standard DD/MM/YYYY format.
 */
export function formatDateDMY(dateStr: string | Date | undefined): string {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'N/A';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

