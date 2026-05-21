export const renderWorkbenchHomePage = (): string => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GrassEye Local Workbench</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #f7f7f4; color: #1f2933; }
    main { max-width: 900px; margin: 0 auto; padding: 32px 20px; }
    h1 { font-size: 28px; margin: 0 0 8px; }
    section { margin-top: 24px; padding: 18px; border: 1px solid #d7d7cf; background: #fff; border-radius: 8px; }
    pre { overflow: auto; padding: 12px; background: #f1f1ec; border-radius: 4px; }
  </style>
</head>
<body>
  <main>
    <h1>GrassEye Local Workbench</h1>
    <p>Local workbench for lawful job flows.</p>
    <section>
      <h2>Endpoints</h2>
      <pre>GET  /api/health
GET  /api/mode
POST /api/amazon-invoice-upload/mission
POST /api/amazon-invoice-upload/task
POST /api/amazon-invoice-upload/task/resume
GET  /api/amazon-invoice-upload/task?taskId=...</pre>
      <pre>POST /api/facebook-product-video-mining/mission
GET  /api/facebook-product-video-mining/run?runId=...
GET  /api/facebook-product-video-mining/latest</pre>
    </section>
  </main>
</body>
</html>`;