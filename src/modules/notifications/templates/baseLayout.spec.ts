import { renderBaseLayout } from './baseLayout';

describe('renderBaseLayout', () => {
  it('inclui título e corpo no HTML', () => {
    const { html } = renderBaseLayout({
      title: 'Olá',
      bodyHtml: '<p>corpo</p>',
      bodyText: 'corpo',
    });
    expect(html).toContain('<title>Olá</title>');
    expect(html).toContain('<p>corpo</p>');
  });

  it('escapa o título', () => {
    const { html } = renderBaseLayout({
      title: '<b>&"x"</b>',
      bodyHtml: '',
      bodyText: '',
    });
    expect(html).not.toContain('<b>&');
    expect(html).toContain('&lt;b&gt;&amp;&quot;x&quot;&lt;/b&gt;');
  });

  it('não escapa o corpo HTML', () => {
    const { html } = renderBaseLayout({
      title: 't',
      bodyHtml: '<p>oi</p>',
      bodyText: 'oi',
    });
    expect(html).toContain('<p>oi</p>');
  });

  it('gera texto simples sem tags', () => {
    const { text } = renderBaseLayout({
      title: 'Título',
      bodyHtml: '<p>oi</p>',
      bodyText: 'corpo simples',
    });
    expect(text.startsWith('Título')).toBe(true);
    expect(text).toContain('corpo simples');
    expect(text).not.toMatch(/<[a-z]/i);
  });
});
