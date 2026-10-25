import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { mathDelimiters, ReplyFiles, ReplyText, tablesApart } from './text';

const html = (text: string): string => renderToStaticMarkup(<ReplyText text={text} />);

describe('ReplyText', () => {
  it('draws a table written straight under a sentence, with its head', () => {
    const out = html('Result:\n| n | a(n) |\n|---|---|\n| 7 | 127 |\n| 8 | 323 |');
    expect(out).toMatch(/<p>Result:<\/p>\s*<div[^>]*><table/);
    expect(out).toMatch(/<th[^>]*>n<\/th>\s*<th[^>]*>a\(n\)<\/th>/);
    expect(out).toMatch(/<td[^>]*>8<\/td>\s*<td[^>]*>323<\/td>/);
    expect(out).not.toContain('---');
  });

  it('keeps a fenced block as code, and a table inside it as text', () => {
    expect(html('Ran:\n```python\nx = 1\n**y** = 2\n```\nok')).toMatch(
      /<pre[^>]*>x = 1\n\*\*y\*\* = 2<\/pre>/,
    );
    expect(tablesApart('```\nsay\n| not a table |\n```')).toBe('```\nsay\n| not a table |\n```');
  });

  it('draws LaTeX with KaTeX, inline and as a block', () => {
    const out = html(
      'The count is $C_n = \\frac{1}{n+1}\\binom{2n}{n}$.\n\n$$\\sum_{n\\ge0} C_n x^n$$',
    );
    expect(out).toContain('class="katex"');
    expect(out).toContain('katex-display');
    expect(out).not.toContain('$');
  });

  it('links A-numbers and arXiv ids to their entries, as chips', () => {
    const out = html('This is A000108, bounded in arXiv:1711.10325.');
    expect(out).toMatch(
      /<a href="https:\/\/oeis.org\/A000108"[^>]*data-cite="oeis"[^>]*>A000108<\/a>/,
    );
    expect(out).toMatch(/<a href="https:\/\/arxiv.org\/abs\/1711.10325"[^>]*data-cite="arxiv"/);
  });

  it('shows a project file as an image, and only links any other image', () => {
    const out = renderToStaticMarkup(
      <ReplyFiles link={(path) => `/api/projects/p1/files${path.replace(/^\/mnt/, '')}`}>
        <ReplyText text="![plot](/mnt/output/plot.png) ![x](https://example.com/t.png)" />
      </ReplyFiles>,
    );
    expect(out).toContain('<img src="/api/projects/p1/files/output/plot.png" alt="plot"');
    expect(out).not.toContain('src="https://example.com/t.png"');
    expect(out).toContain('href="https://example.com/t.png"');
  });

  it('never draws what a model writes as HTML, and refuses script links', () => {
    const out = html(
      '<script>alert(1)</script> [x](javascript:alert(1)) <img src=x onerror=alert(1)>',
    );
    expect(out).not.toContain('<script');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('href="javascript');
  });
});

describe('KaTeX', () => {
  it('loads the stylesheet of the same version that rehype-katex renders with', () => {
    // Two versions name their classes differently: with 0.19's CSS over
    // 0.16's HTML every fraction and exponent was drawn at full size, on top
    // of each other.
    const here = createRequire(import.meta.url);
    const fromPlugin = createRequire(here.resolve('rehype-katex'));
    const version = (path: string): string =>
      (JSON.parse(readFileSync(path, 'utf8')) as { version: string }).version;
    expect(version(here.resolve('katex/package.json'))).toBe(
      version(fromPlugin.resolve('katex/package.json')),
    );
  });
});

describe('LaTeX written with backslash delimiters', () => {
  it('turns \\( \\) and \\[ \\] into dollar signs', () => {
    expect(mathDelimiters('length \\( n \\), so')).toBe('length $n$, so');
    expect(mathDelimiters('then \\[ M(x) = 1 + xM(x) \\] holds')).toBe(
      'then \n$$\nM(x) = 1 + xM(x)\n$$\n holds',
    );
  });

  it('leaves code alone', () => {
    expect(mathDelimiters('`\\(x\\)` and ```\n\\[y\\]\n```')).toBe(
      '`\\(x\\)` and ```\n\\[y\\]\n```',
    );
  });

  it('draws them with KaTeX', () => {
    const out = html('grows like \\( C \\cdot \\frac{3^{n}}{n^{3/2}} \\) and \\[ M(0) = 1 \\]');
    expect(out.match(/class="katex"/g)?.length).toBe(2);
    expect(out).toContain('katex-display');
  });
});
