import React from 'react';
import { ProjectStage, STAGE_META } from '../../utils/projectUtils';

export interface DashboardSummary {
  total: number;
  planning: number;
  ongoing: number;
  completed: number;
}

export interface DashboardMetricsProps {
  summary: DashboardSummary;
  searchQuery: string;
  onSearch: (query: string) => void;
  onStageClick?: (stage: ProjectStage | 'all') => void;
}

export const DashboardMetrics: React.FC<DashboardMetricsProps> = ({
  summary,
  searchQuery,
  onSearch,
  onStageClick
}) => {
  const handleCardClick = (stage: ProjectStage | 'all') => {
    if (onStageClick) {
      onStageClick(stage);
    }

    if (stage === 'all') {
      const topEl = document.getElementById('dashboard-sections-container');
      if (topEl) {
        topEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      const sectionEl = document.getElementById(`section-${stage}`);
      if (sectionEl) {
        sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        sectionEl.classList.remove('section-highlight');
        // Force reflow for re-animation
        void sectionEl.offsetWidth;
        sectionEl.classList.add('section-highlight');
        setTimeout(() => {
          sectionEl.classList.remove('section-highlight');
        }, 1600);
      }
    }
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '0.85rem',
        marginBottom: '1.5rem'
      }}
    >
      {/* ── 1. Total Projects (All Projects) Card with Search Option ── */}
      <div
        className="stage-metric-card"
        onClick={() => handleCardClick('all')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '0.5rem',
          cursor: 'pointer',
          background: 'white'
        }}
        title="View all project stages"
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
          <div>
            <div
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              All Projects
            </div>
            <div
              style={{
                fontSize: '1.35rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                marginTop: '1px',
                lineHeight: 1.1
              }}
            >
              {summary.total}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '1px' }}>
              Complete portfolio
            </div>
          </div>
          <div style={{ fontSize: '1.35rem', opacity: 0.8 }}>📁</div>
        </div>

        {/* Instant Search Input Box */}
        <div
          style={{ position: 'relative', width: '100%' }}
          onClick={e => e.stopPropagation()}
        >
          <input
            type="text"
            className="form-input"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={e => onSearch(e.target.value)}
            style={{
              padding: '0.3rem 0.55rem 0.3rem 1.65rem',
              fontSize: '0.76rem',
              height: '28px',
              borderRadius: '6px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              width: '100%',
              boxSizing: 'border-box'
            }}
          />
          <span
            style={{
              position: 'absolute',
              left: '0.5rem',
              top: '50%',
              transform: 'translateY(-50%)',
              opacity: 0.5,
              fontSize: '0.72rem',
              pointerEvents: 'none'
            }}
          >
            🔍
          </span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearch('')}
              title="Clear search"
              style={{
                position: 'absolute',
                right: '0.45rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.72rem',
                padding: '2px'
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── 2. Planning Metric Card (Steps 1–7) ── */}
      <div
        className="stage-metric-card"
        onClick={() => handleCardClick('planning')}
        style={{
          borderLeft: `4px solid ${STAGE_META.planning.accentColor}`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '0.5rem',
          cursor: 'pointer',
          background: 'white'
        }}
        title="Click to jump to Planning stage section"
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span
                className="stage-badge"
                style={{
                  backgroundColor: STAGE_META.planning.bgLight,
                  color: STAGE_META.planning.textColor,
                  border: `1px solid ${STAGE_META.planning.borderColor}`,
                  fontSize: '0.75rem',
                  padding: '0.18rem 0.5rem',
                  fontWeight: 700,
                  borderRadius: '4px'
                }}
              >
                Planning
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Steps 1–7
              </span>
            </div>
            <div
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: STAGE_META.planning.textColor,
                marginTop: '2px',
                lineHeight: 1.1
              }}
            >
              {summary.planning}
            </div>
          </div>
          <div style={{ fontSize: '1.35rem' }}>📋</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>
          <span>QbD Foundation & Scoping</span>
          <span style={{ color: STAGE_META.planning.accentColor, fontWeight: 600, fontSize: '0.75rem' }}>
            Jump ↓
          </span>
        </div>
      </div>

      {/* ── 3. On-going Metric Card (Steps 8–15) ── */}
      <div
        className="stage-metric-card"
        onClick={() => handleCardClick('ongoing')}
        style={{
          borderLeft: `4px solid ${STAGE_META.ongoing.accentColor}`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '0.5rem',
          cursor: 'pointer',
          background: 'white'
        }}
        title="Click to jump to On-going stage section"
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span
                className="stage-badge"
                style={{
                  backgroundColor: STAGE_META.ongoing.bgLight,
                  color: STAGE_META.ongoing.textColor,
                  border: `1px solid ${STAGE_META.ongoing.borderColor}`,
                  fontSize: '0.75rem',
                  padding: '0.18rem 0.5rem',
                  fontWeight: 700,
                  borderRadius: '4px'
                }}
              >
                On-going
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Steps 8–15
              </span>
            </div>
            <div
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: STAGE_META.ongoing.textColor,
                marginTop: '2px',
                lineHeight: 1.1
              }}
            >
              {summary.ongoing}
            </div>
          </div>
          <div style={{ fontSize: '1.35rem' }}>🧪</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>
          <span>DoE Runs & Bayesian Loop</span>
          <span style={{ color: STAGE_META.ongoing.accentColor, fontWeight: 600, fontSize: '0.75rem' }}>
            Jump ↓
          </span>
        </div>
      </div>

      {/* ── 4. Completed Metric Card (Steps 16–17) ── */}
      <div
        className="stage-metric-card"
        onClick={() => handleCardClick('completed')}
        style={{
          borderLeft: `4px solid ${STAGE_META.completed.accentColor}`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '0.5rem',
          cursor: 'pointer',
          background: 'white'
        }}
        title="Click to jump to Completed stage section"
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span
                className="stage-badge"
                style={{
                  backgroundColor: STAGE_META.completed.bgLight,
                  color: STAGE_META.completed.textColor,
                  border: `1px solid ${STAGE_META.completed.borderColor}`,
                  fontSize: '0.75rem',
                  padding: '0.18rem 0.5rem',
                  fontWeight: 700,
                  borderRadius: '4px'
                }}
              >
                Completed
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Steps 16–17
              </span>
            </div>
            <div
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: STAGE_META.completed.textColor,
                marginTop: '2px',
                lineHeight: 1.1
              }}
            >
              {summary.completed}
            </div>
          </div>
          <div style={{ fontSize: '1.35rem' }}>✅</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>
          <span>Optimum & Final Reports</span>
          <span style={{ color: STAGE_META.completed.accentColor, fontWeight: 600, fontSize: '0.75rem' }}>
            Jump ↓
          </span>
        </div>
      </div>
    </div>
  );
};

export default DashboardMetrics;
