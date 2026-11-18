// frontend/src/types/projectInput.ts
// Request and response interfaces for project input template auto-alignment

export type SingleProjectInputField =
  | 'project_name'
  | 'compound_api'
  | 'primary_objective'
  | 'project_description'

export type ProjectInputField = SingleProjectInputField | 'all'

export interface AlignInputRequest {
  field: ProjectInputField
  raw_text: string
}

export interface AlignInputResponse {
  aligned: Partial<Record<SingleProjectInputField, string>>
  missing: Record<string, string[]>
  warnings: string[]
}

export interface ExtractDocResponse {
  filename: string
  extracted_text: string
  char_count: number
}
