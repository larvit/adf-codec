# Changelog

## Unreleased

- **Breaking:** directives, the opaque carry among them (now `carry`), are spelled under an `!adf:`
  prefix (`!adf:name … !adf:/name`, `!adf:name[content]{attrs}`, `!adf:name arg {attrs}`) in place
  of the `:::`/`::`/`:name` forms; convert stored markdown per `MIGRATION.md`.
- **Breaking:** `unspellable-link` leaves `ConvertErrorCode`; a link whose `href` or `title` no
  CommonMark escape spells is written as `!adf:link[text]{attrs}`.
- Add `adfToPlainMarkdown` and `plainMarkdownToAdf`, a lossy pair converting ADF to and from
  markdown GitHub, GitLab and Obsidian render: alerts, callouts, task lists, `==highlights==` and
  pipe tables.
- Spell `rule`'s `color`, `style` and `weight` and `layoutSection`'s `columnRuleStyle` directly
  where they rode the opaque carry.
- Fix a link whose text holds another link: the inner link is kept and the outer brackets stay
  text, where the outer link was dropped.
- Fix an image inside another image's description: it flattens into the alt text, where it was
  refused.

## 0.1.0

- First release: lossless conversion between ADF and an extended markdown flavour —
  `adfToMarkdown`, `markdownToAdf` and `isAdfDocument`. Plain CommonMark is valid input, nothing
  throws, and every error carries a `code` from a closed list.
