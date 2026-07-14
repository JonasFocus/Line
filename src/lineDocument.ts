export interface LineDocument {
  id: string
  title: string
  content: string
  folder: string
  tags: string[]
  favorite: boolean
  updatedAt: string
  path: string | null
  revision: string | null
  dirty?: boolean
}
