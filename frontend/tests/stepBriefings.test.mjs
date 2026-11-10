import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('DOE Workflow Sidebar Step Briefings Test', () => {
  const configFile = path.resolve(__dirname, '../src/config/stepBriefings.ts')
  const content = fs.readFileSync(configFile, 'utf8')

  const EXPECTED_STEPS = [
    { key: 'create-project', num: 1, title: 'Create Project' },
    { key: 'qtpp', num: 2, title: 'QTPP Definition' },
    { key: 'cqa', num: 3, title: 'CQA Derivation' },
    { key: 'route-mapping', num: 4, title: 'Route Mapping' },
    { key: 'risk-assessment', num: 5, title: 'Risk Assessment' },
    { key: 'stage-campaign-matrix', num: 6, title: 'Stage Campaign Matrix' },
    { key: 'define-factors', num: 7, title: 'Define Factors & Responses' },
    { key: 'recommend-doe', num: 8, title: 'Recommend DOE' },
    { key: 'generate-doe', num: 9, title: 'DOE Matrix & Results' },
    { key: 'initial-optimization', num: 10, title: 'Initial Optimum' },
    { key: 'enough-data', num: 11, title: 'Enough Data?' },
    { key: 'gp-model', num: 12, title: 'GP Model' },
    { key: 'bayesian-opt', num: 13, title: 'Bayesian Optimization' },
    { key: 'new-experiment', num: 14, title: 'New Experiment' },
    { key: 'final-optimum', num: 15, title: 'Final Optimum' },
    { key: 'report', num: 16, title: 'Generate Report' }
  ]

  test('all 16 workflow step briefing definitions are present in stepBriefings.ts', () => {
    for (const step of EXPECTED_STEPS) {
      assert.ok(content.includes(`'${step.key}':`), `Missing briefing key: ${step.key}`)
      assert.ok(content.includes(`step: ${step.num}`), `Missing step number: ${step.num} for ${step.key}`)
      assert.ok(content.includes(`title: '${step.title}'`), `Missing title: ${step.title} for ${step.key}`)
    }
  })

  test('Sidebar component renders StepInfoButton and integrates StepInfoPopup without navigating', () => {
    const sidebarPath = path.resolve(__dirname, '../src/components/Layout/Sidebar.tsx')
    const sidebarCode = fs.readFileSync(sidebarPath, 'utf8')

    // Must import StepInfoButton and StepInfoPopup
    assert.ok(sidebarCode.includes('StepInfoButton'), 'Sidebar must include StepInfoButton')
    assert.ok(sidebarCode.includes('StepInfoPopup'), 'Sidebar must include StepInfoPopup')

    // Must pass onToggle handler that sets popup state without navigating
    assert.ok(sidebarCode.includes('handleToggleInfo'), 'Sidebar must have toggle handler')
    assert.ok(sidebarCode.includes('activeBriefing'), 'Sidebar must maintain activeBriefing state')
    assert.ok(sidebarCode.includes('<StepInfoPopup'), 'Sidebar must mount StepInfoPopup')
  })

  test('StepInfoButton prevents event propagation so clicking does not trigger step navigation', () => {
    const componentPath = path.resolve(__dirname, '../src/components/StepInfoPopup.tsx')
    const compCode = fs.readFileSync(componentPath, 'utf8')

    // Verifies stopPropagation & preventDefault
    assert.ok(compCode.includes('e.stopPropagation()'), 'StepInfoButton must call stopPropagation')
    assert.ok(compCode.includes('e.preventDefault()'), 'StepInfoButton must call preventDefault')
    assert.ok(compCode.includes('aria-label='), 'StepInfoButton must define accessible aria-label')
    assert.ok(compCode.includes('role="dialog"'), 'StepInfoPopup must provide dialog role')
    assert.ok(compCode.includes("e.key === 'Escape'"), 'StepInfoPopup must close on Escape key')
  })
})

