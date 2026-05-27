const AMAZON_MASTER_REPORT_STYLE_TEXT = `
      :root {
        color-scheme: light;
        font-family: Georgia, "Iowan Old Style", serif;
        background: #f5efe1;
        color: #1f2933;
      }
      body {
        margin: 0;
        padding: 32px;
        background:
          radial-gradient(circle at top left, rgba(167, 123, 64, 0.16), transparent 40%),
          linear-gradient(180deg, #f5efe1 0%, #fcfaf5 100%);
      }
      h1, h2, h3 {
        margin: 0 0 16px;
      }
      h1 {
        font-size: 34px;
      }
      h2 {
        font-size: 22px;
        margin-top: 28px;
      }
      h3 {
        font-size: 18px;
        margin-top: 20px;
      }
      p, li, td, th {
        line-height: 1.6;
        font-size: 14px;
      }
      .hero, .panel, .card {
        background: rgba(255, 255, 255, 0.84);
        border: 1px solid rgba(94, 71, 38, 0.14);
        border-radius: 18px;
        padding: 18px;
        border: 1px solid rgba(41, 28, 12, 0.08);
      }
      .grid {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        padding: 10px 8px;
        border-bottom: 1px solid rgba(94, 71, 38, 0.12);
        vertical-align: top;
      }
      .section-stack {
        display: grid;
        gap: 16px;
      }`;

export const renderAmazonMasterReportHtmlDocument = (body: string): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Amazon Product Mining Master Evidence Report</title>
    <style>${AMAZON_MASTER_REPORT_STYLE_TEXT}
    </style>
  </head>
  <body>${body}</body>
</html>`;