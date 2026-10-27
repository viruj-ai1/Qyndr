// frontend/src/components/PlotlyChart.tsx
import React, { useEffect, useRef, useState } from 'react'

interface PlotlyChartProps {
  data: any[]
  layout?: any
  config?: any
  style?: React.CSSProperties
  className?: string
}

declare global {
  interface Window {
    Plotly?: any
  }
}

export default function PlotlyChart({ data, layout = {}, config = {}, style = {}, className = '' }: PlotlyChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [plotlyLoaded, setPlotlyLoaded] = useState<boolean>(typeof window !== 'undefined' && !!window.Plotly)

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (window.Plotly) {
      setPlotlyLoaded(true)
      return
    }

    // Fallback: Dynamically load Plotly CDN if not already in document head
    let script = document.querySelector('script[src*="plotly"]') as HTMLScriptElement
    if (!script) {
      script = document.createElement('script')
      script.src = 'https://cdn.plot.ly/plotly-2.35.2.min.js'
      script.async = true
      document.head.appendChild(script)
    }

    const onLoad = () => setPlotlyLoaded(true)
    script.addEventListener('load', onLoad)
    return () => {
      script.removeEventListener('load', onLoad)
    }
  }, [])

  useEffect(() => {
    if (!plotlyLoaded || !containerRef.current || !window.Plotly || !data) return

    const container = containerRef.current

    // Responsive layout styling for clean integration into chat bubble
    const mergedLayout = {
      autosize: true,
      paper_bgcolor: 'rgba(255, 255, 255, 0.98)',
      plot_bgcolor: 'rgba(255, 255, 255, 0.98)',
      margin: { l: 50, r: 30, t: 50, b: 50 },
      font: { family: 'inherit', color: '#1e293b' },
      ...layout,
    }

    const finalConfig = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
      ...config,
    }

    window.Plotly.newPlot(container, data, mergedLayout, finalConfig)

    const handleResize = () => {
      if (container && window.Plotly) {
        window.Plotly.Plots.resize(container)
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (container && window.Plotly) {
        try {
          window.Plotly.purge(container)
        } catch {
          // Ignore unmount errors
        }
      }
    }
  }, [plotlyLoaded, data, layout])

  return (
    <div
      style={{
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid var(--border, #cbd5e1)',
        background: '#ffffff',
        width: '100%',
        minHeight: '340px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        ...style,
      }}
      className={className}
    >
      {!plotlyLoaded && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '340px', color: '#64748b' }}>
          Loading interactive chart...
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: '340px' }} />
    </div>
  )
}
