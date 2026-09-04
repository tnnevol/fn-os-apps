import fs from 'node:fs'
import path from 'node:path'

export function checkSddDocs(root: string): string[] {
  const docsRoot = path.join(root, 'docs')
  const errors: string[] = []

  const markdownFiles = (directory: string): string[] => {
    if (!fs.existsSync(directory)) return []
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) return markdownFiles(absolute)
      return entry.isFile() && entry.name.endsWith('.md') ? [absolute] : []
    })
  }
  const relative = (file: string): string => path.relative(root, file) || file
  const read = (file: string): string => fs.readFileSync(file, 'utf8')
  const frontmatter = (content: string): Map<string, string> | undefined => {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
    if (!match?.[1]) return undefined
    const fields = new Map<string, string>()
    for (const line of match[1].split(/\r?\n/)) {
      const field = line.match(/^([A-Za-z][\w-]*):\s*(.+)$/)
      if (field?.[1] && field[2]) fields.set(field[1], field[2].trim())
    }
    return fields
  }
  const hasMetadataRow = (content: string, label: string, pattern: string): boolean => (
    new RegExp(`^\\|\\s*${label}\\s*\\|\\s*${pattern}\\s*\\|`, 'm').test(content)
  )
  const routeFile = (route: string): string | undefined => {
    const clean = route.split('#', 1)[0]?.split('?', 1)[0]
    if (!clean?.startsWith('/')) return undefined
    if (clean.endsWith('/')) return path.join(docsRoot, clean.slice(1), 'index.md')
    return path.join(docsRoot, `${clean.slice(1)}.md`)
  }
  const checkInternalLinks = (file: string, content: string): void => {
    const linkPattern = /\]\((\/[^)\s]+)(?:#[^)\s]+)?\)/g
    for (const match of content.matchAll(linkPattern)) {
      const target = match[1] === undefined ? undefined : routeFile(match[1])
      if (target !== undefined && !fs.existsSync(target)) {
        errors.push(`${relative(file)}: internal link target does not exist: ${match[1]}`)
      }
    }
  }
  const collectUniqueIds = (files: string[], pattern: RegExp, label: string): void => {
    const seen = new Map<string, string>()
    for (const file of files) {
      const content = read(file)
      for (const match of content.matchAll(pattern)) {
        const id = match[1]
        if (id === undefined) continue
        const previous = seen.get(id)
        if (previous !== undefined) errors.push(`${label} ${id} is duplicated in ${relative(previous)} and ${relative(file)}`)
        else seen.set(id, file)
      }
    }
  }
  const checkDocument = (file: string, kind: 'requirement' | 'plan'): void => {
    const content = read(file)
    const metadata = frontmatter(content)
    if (metadata === undefined) errors.push(`${relative(file)}: missing frontmatter`)
    else {
      for (const field of ['title', 'description']) {
        if (!metadata.get(field)) errors.push(`${relative(file)}: frontmatter field ${field} is required`)
      }
      for (const field of ['id', 'status', 'owner', 'targetVersion', 'lastVerified']) {
        if (!metadata.get(field)) errors.push(`${relative(file)}: frontmatter field ${field} is required for SDD tracking`)
      }
      const lastVerified = metadata.get('lastVerified')
      if (lastVerified !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(lastVerified)) {
        errors.push(`${relative(file)}: lastVerified must use YYYY-MM-DD`)
      }
    }
    if (!/^#\s+.+/m.test(content)) errors.push(`${relative(file)}: missing level-one title`)
    if (kind === 'requirement') {
      if (!hasMetadataRow(content, '需求编号', 'FNOS-\\d+')) errors.push(`${relative(file)}: missing FNOS requirement metadata row`)
      if (!/\]\(\/plans\/[^)]+\)/.test(content)) errors.push(`${relative(file)}: missing link to a plan document`)
    }
    if (kind === 'plan') {
      if (!hasMetadataRow(content, '计划编号', 'PLAN-FNOS-\\d+')) errors.push(`${relative(file)}: missing PLAN-FNOS metadata row`)
      if (!/\]\(\/requirements\/[^)]+\)/.test(content)) errors.push(`${relative(file)}: missing link to a requirement document`)
    }
    checkInternalLinks(file, content)
  }

  for (const required of [
    path.join(docsRoot, 'requirements', 'index.md'),
    path.join(docsRoot, 'plans', 'index.md'),
    path.join(docsRoot, 'guide', 'sdd-workflow.md'),
    path.join(docsRoot, 'validation', 'README.md'),
  ]) {
    if (!fs.existsSync(required)) errors.push(`required SDD file does not exist: ${relative(required)}`)
  }

  const requirementFiles = markdownFiles(path.join(docsRoot, 'requirements')).filter(file => path.basename(file) !== 'index.md')
  const planFiles = markdownFiles(path.join(docsRoot, 'plans')).filter(file => path.basename(file) !== 'index.md')
  for (const file of requirementFiles) checkDocument(file, 'requirement')
  for (const file of planFiles) checkDocument(file, 'plan')
  collectUniqueIds(requirementFiles, /^\|\s*(FNOS-\d+-\d+)\s*\|/gm, 'requirement feature ID')
  collectUniqueIds(planFiles, /^\|\s*(PLAN-FNOS-\d+(?:-T\d+(?:-\d+)?)?)\s*\|/gm, 'plan ID')
  return errors
}
