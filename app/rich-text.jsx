import { parseRichText } from '../lib/rich-text'
import './rich-text.css'

function Inline({nodes}) {
  return nodes.map((node, index) => {
    const children = node.children ? <Inline nodes={node.children}/> : node.text
    switch (node.type) {
      case 'bold': return <strong key={index}>{children}</strong>
      case 'italic': return <em key={index}>{children}</em>
      case 'underline': return <u key={index}>{children}</u>
      case 'strike': return <s key={index}>{children}</s>
      case 'mark': return <mark key={index}>{children}</mark>
      case 'link': {
        const external = /^https?:/i.test(node.href)
        return <a key={index} href={node.href} {...(external ? {target:'_blank', rel:'noopener noreferrer'} : {})}>{children}</a>
      }
      default: return <span key={index}>{node.text}</span>
    }
  })
}

// Renders text written with the admin formatting toolbar (see lib/rich-text.js).
export function RichText({source, className = '', empty = null}) {
  const blocks = parseRichText(source)
  if (!blocks.length) return empty
  return <div className={'rich-text ' + className}>
    {blocks.map((block, index) => {
      switch (block.type) {
        case 'heading': return block.level === 1
          ? <h3 key={index}><Inline nodes={block.children}/></h3>
          : <h4 key={index}><Inline nodes={block.children}/></h4>
        case 'list': return <ul key={index}>{block.items.map((item, i) => <li key={i}><Inline nodes={item}/></li>)}</ul>
        case 'ordered': return <ol key={index}>{block.items.map((item, i) => <li key={i}><Inline nodes={item}/></li>)}</ol>
        case 'quote': return <blockquote key={index}>{block.lines.map((line, i) => <p key={i}><Inline nodes={line}/></p>)}</blockquote>
        case 'rule': return <hr key={index}/>
        case 'image': return <figure key={index}>
          <img src={block.src} alt={block.alt} loading="lazy" decoding="async"/>
          {block.alt && <figcaption>{block.alt}</figcaption>}
        </figure>
        default: return <p key={index}>{block.lines.map((line, i) => <span key={i}>{i > 0 && <br/>}<Inline nodes={line}/></span>)}</p>
      }
    })}
  </div>
}
