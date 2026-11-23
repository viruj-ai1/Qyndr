// src/utils/projectUtils.ts
// Project Stage categorization and step mapping utilities for Viruj Chematrix

import { EXPERIMENT_SETUP_TITLE } from '../config/workflowSteps';

export type ProjectStage = 'planning' | 'ongoing' | 'completed';

export const TOTAL_WORKFLOW_STEPS = 16;

/**
 * Classifies a project into one of the three workflow stages:
 * - Planning: Steps 1 – 5 or status === 'PLANNING'
 * - On-going: Steps 6 – 14 or status === 'ON-GOING' / 'ONGOING'
 * - Completed: Steps 15 – 16 or status === 'COMPLETED' or isFinished
 */
export function getProjectStage(
  currentStep: number,
  isFinished?: boolean,
  status?: string
): ProjectStage {
  const normStatus = (status || '').trim().toUpperCase();
  if (normStatus === 'COMPLETED' || isFinished || currentStep >= 15) return 'completed';
  if (normStatus === 'ON-GOING' || normStatus === 'ONGOING' || (currentStep >= 6 && currentStep <= 14)) return 'ongoing';
  if (normStatus === 'PLANNING' || currentStep <= 5) return 'planning';
  return currentStep >= 15 ? 'completed' : currentStep >= 6 ? 'ongoing' : 'planning';
}

/**
 * Normalizes an API / Compound name for grouping.
 * Trims whitespace, takes text before the first '(', and uses lowercase for keying.
 */
export function normalizeProductGroup(compound?: string | null): { key: string; displayName: string } {
  if (!compound || !compound.trim()) {
    return { key: '__unassigned__', displayName: 'Other / Unassigned' };
  }
  const trimmed = compound.trim();
  const base = trimmed.split('(')[0].trim();
  if (!base) {
    return { key: '__unassigned__', displayName: 'Other / Unassigned' };
  }
  return { key: base.toLowerCase(), displayName: base };
}

export const STEP_KEY_TO_NUMBER: Record<string, number> = {
  'welcome': 1,
  'create-project': 1,
  'qtpp': 2,
  'cqa': 3,
  'route-mapping': 4,
  'risk-assessment': 5,
  'cqa-risk': 5,
  'stage-campaign-matrix': 6,
  'phase0-summary': 6,
  'stage-overview': 6,
  'campaign-dashboard': 6,
  'understand-process': 6,
  'define-factors': 6,
  'recommend-doe': 7,
  'generate-doe': 8,
  'lab-experiments': 8,
  'upload-results': 8,
  'initial-optimization': 9,
  'statistical-analysis': 9,
  'enough-data': 10,
  'more-improvement': 10,
  'gp-model': 11,
  'update-model': 11,
  'bayesian-opt': 12,
  'new-experiment': 13,
  'lab-new': 13,
  'final-optimum': 14,
  'report': 15,
};

export const STEP_NUMBER_TO_LABEL: Record<number, string> = {
  1: '01. Create Project',
  2: '02. QTPP Definition',
  3: `03. ${EXPERIMENT_SETUP_TITLE}`,
  4: '04. Route Mapping',
  5: '05. Risk Assessment',
  6: `06. ${EXPERIMENT_SETUP_TITLE}`,
  7: '07. Recommend DOE',
  8: '08. DOE Matrix & Results',
  9: '09. Initial Optimum',
  10: '10. Enough Data?',
  11: '11. GP Model',
  12: '12. Bayesian Optimization',
  13: '13. New Experiment',
  14: '14. Final Optimum',
  15: '15. Generate Report',
  16: '16. Complete',
};

/**
 * Resolves any step value (string key, number, or undefined) to a 1..16 step number.
 */
export function getStepNumber(currentStep: string | number | undefined): number {
  if (typeof currentStep === 'number') {
    // If legacy step number was passed (e.g. 1..17)
    if (currentStep >= 7) return Math.min(TOTAL_WORKFLOW_STEPS, currentStep - 1);
    return Math.max(1, Math.min(TOTAL_WORKFLOW_STEPS, currentStep));
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
    stepRange: 'Steps 1 – 5',
    subtitle: 'QbD Foundation & Scoping · Steps 1–5',
    includedSteps: 'Step 01 (Create Project) through Step 05 (CQA & Risk Assessment)',
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
    stepRange: 'Steps 6 – 14',
    subtitle: 'DoE Runs & Bayesian Loop · Steps 6–14',
    includedSteps: `Step 06 (${EXPERIMENT_SETUP_TITLE}) through Step 14 (New Experiment / Bayesian Iterations)`,
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

