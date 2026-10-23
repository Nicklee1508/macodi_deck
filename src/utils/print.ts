interface PageSize {
  width: number
  height: number
  margin: number
}

const createIframe = () => {
  const iframe = document.createElement('iframe')
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.position = 'absolute'
  iframe.style.right = '0'
  iframe.style.top = '0'
  iframe.style.border = '0'

  document.body.appendChild(iframe)

  return iframe
}

const writeContent = (doc: Document, printNode: HTMLElement, size: PageSize) => {
  const docType = '<!DOCTYPE html>'

  let style = ''
  let links = ''
  const styleSheets = document.styleSheets
  if (styleSheets) {
    for (const styleSheet of styleSheets) {
      // 다른 주소(CDN 글꼴 등) 스타일은 cssRules 를 읽으면 보안 오류 → 인쇄가 통째로 멈췄음. 링크로 그대로 넣는다
      let rules: CSSRuleList | null = null
      try {
        rules = styleSheet.cssRules
      }
      catch {
        if (styleSheet.href) links += `<link rel="stylesheet" href="${styleSheet.href}">`
        continue
      }
      if (!rules) continue

      for (const rule of rules) {
        style += rule.cssText
      }
    }
  }

  const { width, height, margin } = size
  const head = `
    <head>
      ${links}
      <style type="text/css">
        ${style} 
        html, body {
          height: auto;
          overflow: auto;
        }
        @media print {
          @page {
            size: ${width + 2 * margin}px ${(height + 2 * margin) * 1.005}px;
            margin: ${margin}px;
          }
        }
      </style>
    </head>
  `
  // 선명도·색 온도 SVG 필터 정의(마코디 그림 서식)도 함께 — 없으면 인쇄에서 효과가 빠짐
  const defs = document.getElementById('mcd-image-filter-defs')?.outerHTML || ''
  const body = '<body>' + defs + printNode.innerHTML + '</body>'

  doc.open()
  doc.write(`
    ${docType}
    <html>
      ${head}
      ${body}
    </html>
  `)
  doc.close()
}

export const print = (printNode: HTMLElement, size: PageSize) => {
  const iframe = createIframe()
  const iframeContentWindow = iframe.contentWindow

  if (!iframe.contentDocument || !iframeContentWindow) return
  writeContent(iframe.contentDocument, printNode, size)

  const handleLoadIframe = () => {
    iframeContentWindow.focus()
    iframeContentWindow.print()
  }

  const handleAfterprint = () => {
    iframe.removeEventListener('load', handleLoadIframe)
    iframeContentWindow.removeEventListener('afterprint', handleAfterprint)
    document.body.removeChild(iframe)
  }

  iframe.addEventListener('load', handleLoadIframe)
  iframeContentWindow.addEventListener('afterprint', handleAfterprint)
}