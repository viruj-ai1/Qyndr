// src/utils/projectUtils.ts
// Project Stage categorization and step mapping utilities for Viruj Chematrix

export type ProjectStage = 'planning' | 'ongoing' | 'completed';

/**
 * Classifies a project into one of the three workflow stages:
 * - Planning: Steps 1 – 7 or status === 'PLANNING'
 * - On-going: Steps 8 – 15 or status === 'ON-GOING' / 'ONGOING'
 * - Completed: Steps 16 – 17 or status === 'COMPLETED' or isFinished
 */
export function getProjectStage(
  currentStep: number,
  isFinished?: boolean,
  status?: string
): ProjectStage {
  const normStatus = (status || '').trim().toUpperCase();
  if (normStatus === 'COMPLETED' || isFinished || currentStep >= 16) return 'completed';
  if (normStatus === 'ON-GOING' || normStatus === 'ONGOING' || (currentStep >= 8 && currentStep <= 15)) return 'ongoing';
  if (normStatus === 'PLANNING' || currentStep <= 7) return 'planning';
  return currentStep >= 16 ? 'completed' : currentStep >= 8 ? 'ongoing' : 'planning';
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
    stepRange: 'Steps 1 – 7',
    subtitle: 'QbD Foundation & Scoping · Steps 1–7',
    includedSteps: 'Step 01 (Create Project) through Step 07 (Campaign Dashboard)',
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
    stepRange: 'Steps 8 – 15',
    subtitle: 'DoE Runs & Bayesian Loop · Steps 8–15',
    includedSteps: 'Step 08 (Factors & Responses) through Step 15 (New Experiment / Bayesian Iterations)',
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
    stepRange: 'Steps 16 – 17',
    subtitle: 'Optimum & Final Reports · Steps 16–17',
    includedSteps: 'Step 16 (Final Optimum) and Step 17 (Generate Report)',
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

