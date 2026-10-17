import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReplyText } from './text';

const html = (text: string): string => renderToStaticMarkup(<ReplyText text={text} />);

describe('ReplyText', () => {
  it('draws a table of pipes as a table with its head', () => {
    const out = html('Result:\n| n | a(n) |\n|---|---|\n| 7 | 127 |\n| 8 | 323 |\nDone.');
    expect(out).toMatch(/<p>Result:<\/p>.*<table/s);
    expect(out).toMatch(/<th[^>]*>n<\/th>.*<th[^>]*>a\(n\)<\/th>/s);
    expect(out).toMatch(/<td[^>]*>8<\/td><td[^>]*>323<\/td>/);
    expect(out).not.toContain('---');
    expect(out).toMatch(/<\/table>.*<p>Done\.<\/p>/s);
  });

  it('keeps a fenced block as code, line by line, even when the reply ends inside it', () => {
    expect(html('Ran:\n```python\nx = 1\n**y** = 2\n```\nok')).toMatch(
      /<pre[^>]*>x = 1\n\*\*y\*\* = 2<\/pre><p>ok<\/p>/,
    );
    expect(html('```\nfor n in range(3):\n    print(n)')).toContain(
      'for n in range(3):\n    print(n)</pre>',
    );
  });

  it('still joins a paragraph and draws a list', () => {
    expect(html('one\ntwo\n\n- a\n- **b**')).toMatch(
      /<p>one two<\/p><ul[^>]*><li>a<\/li><li><strong[^>]*>b<\/strong><\/li><\/ul>/,
    );
  });
});
