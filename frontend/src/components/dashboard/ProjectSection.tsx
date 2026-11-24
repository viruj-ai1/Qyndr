import React, { useState } from 'react';
import { ProjectStage, STAGE_META } from '../../utils/projectUtils';

export interface ProjectSectionProps {
  id?: string;
  title: string;
  status?: ProjectStage | string;
  count: number;
  filteredCount?: number;
  subtitle: string;
  accentColor?: string;
  badgeText?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onNewProject?: () => void;
  onEditProductName?: () => void;
  isEditMode?: boolean;
  defaultCollapsed?: boolean;
  searchActive?: boolean;
  searchQuery?: string;
  emptyStateMessage?: string;
  onClearSearch?: () => void;
  children: React.ReactNode;
}

export const ProjectSection: React.FC<ProjectSectionProps> = ({
  id,
  title,
  status = 'ongoing',
  count,
  filteredCount,
  subtitle,
  accentColor,
  badgeText,
  isCollapsed: controlledIsCollapsed,
  onToggleCollapse,
  onNewProject,
  onEditProductName,
  isEditMode = false,
  defaultCollapsed = false,
  searchActive = false,
  searchQuery = '',
  emptyStateMessage,
  onClearSearch,
  children
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);

  const isCollapsed = controlledIsCollapsed !== undefined ? controlledIsCollapsed : internalCollapsed;

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed(!isCollapsed);
    }
  };

  // When search is active with a query, auto-expand so matching results can be seen
  React.useEffect(() => {
    if (searchActive && searchQuery && searchQuery.trim()) {
      if (controlledIsCollapsed === undefined) {
        setInternalCollapsed(false);
      }
    }
  }, [searchActive, searchQuery, controlledIsCollapsed]);

  const isSearchActive = Boolean(searchActive && searchQuery && searchQuery.trim().length > 0);
  const effectiveCollapsed = isSearchActive ? false : isCollapsed;

  // Normalize status to lowercase stage key if possible
  const normStatus = (status || '').toLowerCase().replace(/[^a-z]/g, '') as ProjectStage;
  const stageMeta = STAGE_META[normStatus] || {
    key: 'ongoing' as ProjectStage,
    title: 'Product',
    statusLabel: 'PRODUCT',
    stepRange: '',
    subtitle: '',
    includedSteps: '',
    badgeClasses: '',
    icon: '💊',
    accentColor: '#005baa',
    bgLight: '#eff6ff',
    borderColor: '#bfdbfe',
    textColor: '#1e40af'
  };

  const color = accentColor || stageMeta.accentColor;
  const badgeLabel = badgeText || stageMeta.statusLabel;

  // Determine active displayed count
  const effectiveFilteredCount = filteredCount !== undefined ? filteredCount : count;
  const hasNoMatches = searchActive && count > 0 && effectiveFilteredCount === 0;
  const isSectionEmpty = count === 0;
  const bodyId = id ? `${id}-body` : `section-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-body`;

  return (
    <section id={id} className="project-section">
      {/* ── Section Header (Whole row clickable toggle) ── */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={!effectiveCollapsed}
        aria-controls={bodyId}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleToggle();
          } else if (e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        }}
        className="project-section-header"
        style={{
          backgroundColor: isEditMode ? 'rgba(0, 91, 170, 0.025)' : undefined,
          transition: 'background-color 0.15s ease'
        }}
      >
        <div className="project-section-header-left">
          {/* Stage Accent Pill / Bar */}
          <div
            className="stage-indicator-bar"
            style={{ backgroundColor: color }}
          />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {/* Section Title */}
              <h3 className="project-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                {stageMeta.icon && <span>{stageMeta.icon}</span>}
                <span>{title}</span>
                {onEditProductName && (
                  <button
                    type="button"
                    aria-label={`Edit product name for ${title}`}
                    title={`Rename product "${title}"`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditProductName();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        if (e.key === ' ') e.preventDefault();
                        onEditProductName();
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '2px 4px',
                      cursor: 'pointer',
                      color: '#005baa',
                      borderRadius: '4px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: '0.2rem',
                      opacity: 0.85,
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.backgroundColor = '#eff6ff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '0.85';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  </button>
                )}
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

        {/* ── Header Right: Search Status, + New Project Button & Visual Chevron Indicator ── */}
        <div className="project-section-header-right" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {searchActive && searchQuery && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {effectiveFilteredCount === 0 ? 'No matches' : `Matching "${searchQuery}"`}
            </span>
          )}

          {onNewProject && (
            <button
              type="button"
              className="btn btn-secondary btn-sm section-new-project-btn"
              onClick={(e) => {
                e.stopPropagation();
                onNewProject();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  if (e.key === ' ') e.preventDefault();
                  onNewProject();
                }
              }}
              aria-label={`Create new project in ${title}`}
              title={`Create new project in ${title}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#005baa',
                background: '#ffffff',
                border: '1px solid #93c5fd',
                borderRadius: '6px',
                padding: '0.28rem 0.75rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#eff6ff';
                e.currentTarget.style.borderColor = '#005baa';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.borderColor = '#93c5fd';
              }}
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>+ New Project</span>
            </button>
          )}

          {/* Smooth-rotating chevron indicator */}
          <span
            className="section-chevron-icon"
            style={{
              transform: effectiveCollapsed ? 'rotate(0deg)' : 'rotate(90deg)'
            }}
            aria-hidden="true"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
        </div>
      </div>

      {/* ── Section Content Body ── */}
      {!effectiveCollapsed ? (
        <div id={bodyId} className="project-section-body">
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
      ) : null}
    </section>
  );
};

export default ProjectSection;
