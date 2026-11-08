const markup = /[`[\]*_<>~]/

// The README's first paragraph after the title and the badges.
export function readmeTagline(readme) {
  const lines = readme.split('\n').filter((line, index, all) => index !== all.findIndex((first) => first.startsWith('# ')) && !line.startsWith('[!['))
  const start = lines.findIndex((line) => line.trim() !== '')
  if (start === -1 || lines[start].startsWith('#')) return { error: 'README.md has no tagline paragraph before its first section', ok: false }
  const end = lines.findIndex((line, index) => index > start && line.trim() === '')
  const tagline = lines.slice(start, end === -1 ? undefined : end).map((line) => line.trim()).join(' ')
  if (markup.test(tagline)) return { error: `the README tagline is plain text, since npm shows it as is: ${tagline}`, ok: false }
  return { ok: true, value: tagline }
}
