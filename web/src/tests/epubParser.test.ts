import { describe, it, expect } from 'vitest'
import { EpubParser } from '../core/books/parsers/epubParser'

describe('EpubParser', () => {
  it('должен парсить EPUB файл', async () => {
    // Создаём минимальный EPUB (ZIP с container.xml, OPF, XHTML)
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()

    // META-INF/container.xml
    zip.file('META-INF/container.xml', `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`)

    // OEBPS/content.opf
    zip.file('OEBPS/content.opf', `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0">
  <metadata>
    <dc:title>Test EPUB</dc:title>
    <dc:creator>Test Author</dc:creator>
  </metadata>
  <manifest>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
    <itemref idref="chapter2"/>
  </spine>
</package>`)

    // OEBPS/chapter1.xhtml
    zip.file('OEBPS/chapter1.xhtml', `<?xml version="1.0"?>
<html><body>
<h1>Chapter 1</h1>
<p>This is the first chapter content.</p>
</body></html>`)

    // OEBPS/chapter2.xhtml
    zip.file('OEBPS/chapter2.xhtml', `<?xml version="1.0"?>
<html><body>
<h1>Chapter 2</h1>
<p>This is the second chapter.</p>
<p>With multiple paragraphs.</p>
</body></html>`)

    const epubBlob = await zip.generateAsync({ type: 'blob' })
    const file = new File([epubBlob], 'test.epub', { type: 'application/epub+zip' })

    const parser = new EpubParser()
    const book = await parser.parse(file)

    expect(book.metadata.title).toBe('Test EPUB')
    expect(book.metadata.author).toBe('Test Author')
    expect(book.metadata.format).toBe('epub')
    expect(book.chapters.length).toBeGreaterThanOrEqual(2)
    expect(book.getText(book.chapters[0].id)).toContain('first chapter')
    expect(book.getText(book.chapters[1].id)).toContain('second chapter')
  }, 10000)
})
