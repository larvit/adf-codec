// spec/wiki.md, Blocks: the names Atlassian's text formatting notation help lists for `{code}`.
export const codeLanguages: readonly string[] = [
  'actionscript',
  'ada',
  'applescript',
  'bash',
  'c',
  'c#',
  'c++',
  'css',
  'erlang',
  'go',
  'groovy',
  'haskell',
  'html',
  'java',
  'javascript',
  'json',
  'lua',
  'nyan',
  'objc',
  'perl',
  'php',
  'python',
  'r',
  'ruby',
  'scala',
  'sql',
  'swift',
  'visualbasic',
  'xml',
  'yaml',
]

// spec/wiki.md, Blocks: the `bgColor` Jira writes for each panel type it reads back.
export const panelColours: Readonly<Record<string, string>> = {
  error: '#ffebe6',
  info: '#deebff',
  note: '#eae6ff',
  success: '#e3fcef',
  warning: '#fffae6',
}

// spec/wiki.md, What only the reader reads: each smiley Jira reads as an emoji.
export const smileys: readonly string[] = [
  '(!)',
  '(*)',
  '(*b)',
  '(*g)',
  '(*r)',
  '(*y)',
  '(+)',
  '(-)',
  '(/)',
  '(?)',
  '(flag)',
  '(flagoff)',
  '(i)',
  '(n)',
  '(off)',
  '(on)',
  '(x)',
  '(y)',
  ':(',
  ':)',
  ':D',
  ':P',
  ';)',
]

// spec/wiki.md, Blocks, Inline and Marks: what a bracket, a `|` or a delimiter can hold without a markup character.
export const spellableAlt = /^[^\s!|,\\[\]{}](?:[^!|,\\[\]{}\r\n]*[^\s!|,\\[\]{}])?$/
export const spellableColour = /^#[0-9a-f]{6}$/i
export const spellableImageUrl = /^[^\s!|\\[\]{}]+$/
export const spellableLinkTitle = /^[^\s[\]{}|\\](?:[^[\]{}|\\\r\n]*[^\s[\]{}|\\])?$/
export const spellableUrl = /^[^\s[\]{}|\\]+$/
