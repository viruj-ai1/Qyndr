// src/utils/projectUtils.ts
// Project Stage categorization and step mapping utilities for Viruj Chematrix

import { EXPERIMENT_SETUP_TITLE } from '../config/workflowSteps';

export type ProjectStage = 'planning' | 'ongoing' | 'completed';

export const TOTAL_WORKFLOW_STEPS = 11;

/**
 * Classifies a project into one of the three workflow stages:
 * - Planning: Steps 1 – 4 (CQA/Risk, Experiment Setup, Recommend DOE, DOE Matrix)
 * - On-going: Steps 5 – 10 (Initial Optimum, Bayesian Opt, etc.)
 * - Completed: Step 11 (Report) or isFinished
 */
export function getProjectStage(
  currentStep: number,
  isFinished?: boolean,
  status?: string
): ProjectStage {
  const normStatus = (status || '').trim().toUpperCase();
  if (normStatus === 'COMPLETED' || isFinished || currentStep >= 11) return 'completed';
  if (normStatus === 'ON-GOING' || normStatus === 'ONGOING' || (currentStep >= 5 && currentStep <= 10)) return 'ongoing';
  if (normStatus === 'PLANNING' || currentStep <= 4) return 'planning';
  return currentStep >= 11 ? 'completed' : currentStep >= 5 ? 'ongoing' : 'planning';
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
  'cqa-risk': 1,
  'cqa': 1,
  'route-mapping': 1,
  'risk-assessment': 1,
  'define-factors': 2,
  'understand-process': 2,
  'stage-campaign-matrix': 2,
  'phase0-summary': 2,
  'stage-overview': 2,
  'campaign-dashboard': 2,
  'recommend-doe': 3,
  'generate-doe': 4,
  'lab-experiments': 4,
  'upload-results': 4,
  'initial-optimization': 5,
  'statistical-analysis': 5,
  'initial-optimum': 5,
  'enough-data': 6,
  'more-improvement': 6,
  'gp-model': 7,
  'update-model': 7,
  'bayesian-opt': 8,
  'new-experiment': 9,
  'lab-new': 9,
  'final-optimum': 10,
  'report': 11,
};

export const STEP_NUMBER_TO_LABEL: Record<number, string> = {
  1: '01. CQA & Risk Assessment',
  2: `02. ${EXPERIMENT_SETUP_TITLE}`,
  3: '03. Recommend DOE',
  4: '04. DOE Matrix & Results',
  5: '05. Initial Optimum',
  6: '06. Enough Data?',
  7: '07. GP Model',
  8: '08. Bayesian Optimization',
  9: '09. New Experiment',
  10: '10. Final Optimum',
  11: '11. Generate Report',
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

