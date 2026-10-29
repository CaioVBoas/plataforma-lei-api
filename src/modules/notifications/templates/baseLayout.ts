interface BaseLayoutInput {
  title: string;
  bodyHtml: string;
  bodyText: string;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"]/g, (char) => HTML_ESCAPES[char]);

/** O título é escapado; `bodyHtml` é confiado ao chamador. */
export function renderBaseLayout({
  title,
  bodyHtml,
  bodyText,
}: BaseLayoutInput): { html: string; text: string } {
  const safeTitle = escapeHtml(title);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}</title>
</head>
<body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;padding:24px;border-radius:8px;">
<h1 style="margin:0 0 16px;font-size:20px;">${safeTitle}</h1>
${bodyHtml}
</div>
</body>
</html>`;

  return { html, text: `${title}\n\n${bodyText}` };
}
