// Small, safe formatting language for admin-written text (facilities, camp info).
// Stored as plain text; rendered to React elements, never to raw HTML.
//
//   **ตัวหนา**  *ตัวเอียง*  __ขีดเส้นใต้__  ~~ขีดฆ่า~~  ==ไฮไลต์==  [ข้อความ](https://…)
//   # หัวข้อ   ## หัวข้อรอง   - รายการ   1. รายการลำดับ   > กล่องหมายเหตุ   ---
//   ![คำอธิบาย](facility:12)   ← รูปที่แนบในหน้าแอดมิน (บรรทัดเดี่ยว)

const inlineRules = [
  ['bold', /\*\*(.+?)\*\*/],
  ['underline', /__(.+?)__/],
  ['strike', /~~(.+?)~~/],
  ['mark', /==(.+?)==/],
  ['italic', /\*(.+?)\*/],
  ['link', /\[([^\]]+)\]\(([^)\s]+)\)/],
]

export function safeHref(value) {
  const href = String(value || '').trim()
  if (/^https?:\/\/[^\s]+$/i.test(href) || /^(tel|mailto):[^\s]+$/i.test(href) || /^\/[^/\s][^\s]*$/.test(href)) return href
  return null
}

export function imageSource(value) {
  const match = /^facility:(\d{1,10})$/.exec(String(value || '').trim())
  return match ? '/api/facility-media/' + match[1] : null
}

export function parseInline(text) {
  const nodes = []
  let rest = String(text)
  while (rest) {
    let best = null
    for (const [type, pattern] of inlineRules) {
      const match = pattern.exec(rest)
      if (match && (!best || match.index < best.match.index)) best = { type, match }
    }
    if (!best) { nodes.push({ type:'text', text:rest }); break }
    const { type, match } = best
    if (match.index) nodes.push({ type:'text', text:rest.slice(0, match.index) })
    if (type === 'link') {
      const href = safeHref(match[2])
      nodes.push(href ? { type, href, children:parseInline(match[1]) } : { type:'text', text:match[0] })
    } else {
      nodes.push({ type, children:parseInline(match[1]) })
    }
    rest = rest.slice(match.index + match[0].length)
  }
  return nodes
}

export function parseRichText(source = '') {
  const lines = String(source || '').replace(/\r\n?/g, '\n').split('\n')
  const blocks = []
  let paragraph = null
  const close = () => { paragraph = null }
  for (const raw of lines) {
    const line = raw.trimEnd()
    let match
    if (!line.trim()) { close(); continue }
    if ((match = /^(#{1,2})\s+(.+)$/.exec(line))) {
      close(); blocks.push({ type:'heading', level:match[1].length, children:parseInline(match[2]) }); continue
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { close(); blocks.push({ type:'rule' }); continue }
    if ((match = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(line.trim()))) {
      close()
      const src = imageSource(match[2])
      blocks.push(src ? { type:'image', src, alt:match[1] } : { type:'paragraph', lines:[parseInline(line)] })
      continue
    }
    const bullet = /^\s*[-*•]\s+(.+)$/.exec(line), numbered = /^\s*\d+[.)]\s+(.+)$/.exec(line), quote = /^>\s?(.*)$/.exec(line)
    if (bullet || numbered) {
      close()
      const type = bullet ? 'list' : 'ordered'
      const last = blocks.at(-1)
      const item = parseInline((bullet || numbered)[1])
      if (last?.type === type) last.items.push(item); else blocks.push({ type, items:[item] })
      continue
    }
    if (quote) {
      close()
      const last = blocks.at(-1)
      if (last?.type === 'quote') last.lines.push(parseInline(quote[1])); else blocks.push({ type:'quote', lines:[parseInline(quote[1])] })
      continue
    }
    if (!paragraph) { paragraph = { type:'paragraph', lines:[] }; blocks.push(paragraph) }
    paragraph.lines.push(parseInline(line))
  }
  return blocks
}

// Plain-text version (for previews in lists, aria labels).
export function richTextToPlain(source = '') {
  return String(source || '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|~~|==|\*)(.+?)\1/g, '$2')
    .replace(/^#{1,2}\s+|^\s*[-*•]\s+|^>\s?/gm, '')
}
