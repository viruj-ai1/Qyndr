import React from 'react';
import {
  ProjectStage,
  STAGE_META,
  getStepNumber,
  getStepLabel,
  getProjectStage,
  formatDateDMY
} from '../../utils/projectUtils';

export interface ProjectCardProps {
  project: any;
  onOpen: (project: any) => void;
  onDelete?: (e: React.MouseEvent, id: number) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onOpen
}) => {
  const stepNum = project._stepNum ?? getStepNumber(project.current_step);
  const stepLabel = project._stepLabel ?? getStepLabel(project.current_step);
  const isFinished = project.status?.toLowerCase() === 'completed' || project.is_finished || false;
  const stageKey: ProjectStage = project._stage ?? getProjectStage(stepNum, isFinished, project.status);
  const stageMeta = STAGE_META[stageKey] || STAGE_META.planning;

  const progressPct = Math.round((stepNum / 17) * 100);
  const runsCount = (Array.isArray(project.experiments) ? project.experiments.length : project.experiment_count) || 0;

  return (
    <div
      className="project-card"
      onClick={() => onOpen(project)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%'
      }}
    >
      <div>
        {/* Card Header: Project title and stage badge */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '0.5rem',
            marginBottom: '0.4rem'
          }}
        >
          <div
            className="project-card-name"
            style={{ margin: 0, lineHeight: 1.35, fontSize: '1rem', fontWeight: 600, wordBreak: 'break-word' }}
            title={project.name}
          >
            {project.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
            <span
              className="stage-badge"
              style={{
                backgroundColor: stageMeta.bgLight,
                color: stageMeta.textColor,
                border: `1px solid ${stageMeta.borderColor}`,
                fontSize: '0.75rem',
                padding: '0.18rem 0.5rem',
                fontWeight: 700,
                borderRadius: '4px',
                letterSpacing: '0.02em'
              }}
              title={stageMeta.includedSteps}
            >
              {stageMeta.icon} {stageMeta.statusLabel}
            </span>
          </div>
        </div>

        {/* Compound Info: API / Compound: <Name> in bold teal/cyan accent text */}
        {project.compound && (
          <div
            className="project-card-compound"
            style={{
              marginBottom: '0.4rem',
              fontSize: '0.8125rem',
              color: 'var(--accent)',
              fontWeight: 600
            }}
          >
            API / Compound: <strong>{project.compound}</strong>
          </div>
        )}

        {/* Objective / Summary snippet */}
        {project.objective ? (
          <div
            style={{
              fontSize: '0.8125rem',
              color: '#475569',
              marginBottom: '0.5rem',
              lineHeight: 1.5
            }}
          >
            {project.objective.slice(0, 95)}
            {project.objective.length > 95 ? '…' : ''}
          </div>
        ) : (
          <div
            style={{
              fontSize: '0.8125rem',
              color: 'var(--text-muted)',
              marginBottom: '0.5rem',
              fontStyle: 'italic',
              lineHeight: 1.5
            }}
          >
            Standard QbD optimization campaign workflow.
          </div>
        )}
      </div>

      <div>
        {/* Progress Bar & Step Indicator */}
        <div
          style={{
            marginTop: '0.4rem',
            marginBottom: '0.5rem',
            padding: '0.5rem 0.75rem',
            background: '#f8fafc',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid #f1f5f9'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.75rem',
              fontWeight: 600,
              gap: '0.4rem'
            }}
          >
            <span style={{ color: stageMeta.accentColor, fontWeight: 700 }}>
              {stepLabel}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>
              Step {stepNum} of 17 ({progressPct}%)
            </span>
          </div>
          <div className="stage-progress-bar">
            <div
              className="stage-progress-fill"
              style={{
                width: `${progressPct}%`,
                background: stageMeta.accentColor
              }}
            />
          </div>
        </div>

        {/* Footer Metadata: Runs count, DoE methodology tag, Iteration tag */}
        <div className="project-card-meta" style={{ minHeight: '22px', fontSize: '0.75rem', fontWeight: 500 }}>
          <span>📊 {runsCount} runs</span>
          {project.doe_type && <span>🧪 {project.doe_type}</span>}
          {project.bayes_iter > 0 && (
            <span
              className="badge badge-success"
              style={{ fontSize: '0.75rem', padding: '0.12rem 0.4rem', fontWeight: 600 }}
            >
              Bayes Item {project.bayes_iter}
            </span>
          )}
        </div>

        {/* Footer: Updated timestamp & Action link */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            marginTop: '0.5rem',
            borderTop: '1px solid #f1f5f9',
            paddingTop: '0.5rem'
          }}
        >
          <span>Updated: {formatDateDMY(project.updated_at || project.created_at)}</span>
          <span style={{ color: 'var(--primary)', fontWeight: 700 }}>Open Project →</span>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
