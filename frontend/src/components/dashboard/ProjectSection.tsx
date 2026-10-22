import React, { useState } from 'react';
import { ProjectStage, STAGE_META } from '../../utils/projectUtils';

export interface ProjectSectionProps {
  id?: string;
  title: string;
  status: ProjectStage | string;
  count: number;
  filteredCount?: number;
  subtitle: string;
  accentColor?: string;
  badgeText?: string;
  searchActive?: boolean;
  searchQuery?: string;
  emptyStateMessage?: string;
  onClearSearch?: () => void;
  children: React.ReactNode;
}

export const ProjectSection: React.FC<ProjectSectionProps> = ({
  id,
  title,
  status,
  count,
  filteredCount,
  subtitle,
  accentColor,
  badgeText,
  searchActive = false,
  searchQuery = '',
  emptyStateMessage,
  onClearSearch,
  children
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Normalize status to lowercase stage key if possible
  const normStatus = status.toLowerCase().replace(/[^a-z]/g, '') as ProjectStage;
  const stageMeta = STAGE_META[normStatus] || STAGE_META.planning;

  const color = accentColor || stageMeta.accentColor;
  const badgeLabel = badgeText || stageMeta.statusLabel;

  // Determine active displayed count
  const effectiveFilteredCount = filteredCount !== undefined ? filteredCount : count;
  const hasNoMatches = searchActive && count > 0 && effectiveFilteredCount === 0;
  const isSectionEmpty = count === 0;

  return (
    <section id={id} className="project-section">
      {/* ── Section Header ── */}
      <div className="project-section-header">
        <div className="project-section-header-left">
          {/* Stage Accent Pill / Bar */}
          <div
            className="stage-indicator-bar"
            style={{ backgroundColor: color }}
          />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {/* Section Title */}
              <h3 className="project-section-title">
                {stageMeta.icon && <span>{stageMeta.icon}</span>}
                <span>{title}</span>
              </h3>

              {/* Stage Accent Badge */}
              <span
                className="stage-badge"
                style={{
                  backgroundColor: stageMeta.bgLight,
                  color: stageMeta.textColor,
                  border: `1px solid ${stageMeta.borderColor}`,
                  fontSize: '0.75rem',
                  padding: '0.18rem 0.5rem',
                  fontWeight: 700,
                  borderRadius: '4px'
                }}
              >
                {badgeLabel}
              </span>

              {/* Count Badge (e.g. Planning Projects (1)) */}
              <span
                className="badge"
                style={{
                  backgroundColor: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.55rem',
                  borderRadius: '999px'
                }}
              >
                {searchActive && count > 0 ? (
                  <span>{effectiveFilteredCount} / {count}</span>
                ) : (
                  <span>{count}</span>
                )}
              </span>
            </div>

            {/* Stage Sub-label */}
            <div className="project-section-subtitle" style={{ marginTop: '0.25rem', fontSize: '0.8125rem' }}>
              {subtitle}
            </div>
          </div>
        </div>

        {/* ── Header Right: Search Status & Collapsible Swimlane Button ── */}
        <div className="project-section-header-right">
          {searchActive && searchQuery && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {effectiveFilteredCount === 0 ? 'No matches' : `Matching "${searchQuery}"`}
            </span>
          )}

          <button
            type="button"
            className="section-collapse-btn"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? `Expand ${title}` : `Collapse ${title}`}
            title={isCollapsed ? 'Expand section' : 'Collapse section'}
            style={{ fontSize: '0.75rem' }}
          >
            <span>{isCollapsed ? 'Expand' : 'Collapse'}</span>
            <span style={{ fontSize: '0.72rem', display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
              ▼
            </span>
          </button>
        </div>
      </div>

      {/* ── Section Content Body ── */}
      {!isCollapsed ? (
        <div className="project-section-body">
          {isSectionEmpty ? (
            /* Clean, subtle empty placeholder when 0 projects are in this stage */
            <div className="project-section-empty" style={{ padding: '2.5rem 1.5rem' }}>
              <div style={{ fontSize: '2rem', opacity: 0.85 }}>{stageMeta.icon}</div>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                {emptyStateMessage || `No ${title.toLowerCase()} currently.`}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '440px', lineHeight: 1.5 }}>
                {normStatus === 'completed'
                  ? 'Ongoing projects will appear here once finalized.'
                  : normStatus === 'planning'
                  ? 'New projects begin in the Planning stage (Steps 1–7).'
                  : 'Projects transition to On-going once factor formulation begins.'}
              </div>
            </div>
          ) : hasNoMatches ? (
            /* Minimal "No matching projects" note when search filter has no match in this stage */
            <div className="project-section-no-match" style={{ fontSize: '0.8125rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem' }}>🔍</span>
                <span>
                  No matching projects in <strong>{title}</strong> for "{searchQuery}"
                </span>
              </div>
              {onClearSearch && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                  onClick={onClearSearch}
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            /* Grid of Project Cards with Responsive 4-Column Layout */
            <div className="project-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {children}
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={() => setIsCollapsed(false)}
          style={{
            padding: '0.6rem 1rem',
            background: '#f8fafc',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.76rem',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            textAlign: 'center'
          }}
        >
          Section collapsed ({count} {count === 1 ? 'project' : 'projects'}) · Click to expand
        </div>
      )}
    </section>
  );
};

export default ProjectSection;
