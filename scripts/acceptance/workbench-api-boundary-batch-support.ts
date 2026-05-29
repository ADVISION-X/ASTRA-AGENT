export const createBoundaryBatchRecord = () => {
  const timestamp = new Date().toISOString();
  return {
    batchId: "batch_acceptance",
    taskKind: "invoice_upload_batch" as const,
    mission: { missionType: "amazon_invoice_upload_batch" as const, mode: "batch_upload" as const, marketplace: "AE" as const, sellerCentralEntryUrl: "https://sellercentral.amazon.ae/home", sourceKind: "filename_order_id" as const },
    status: "completed" as const,
    reason: "acceptance_fixture_batch",
    reachedStep: "batch finalized",
    total: 1,
    queued: 0,
    uploading: 0,
    succeeded: 1,
    alreadyUploaded: 0,
    failed: 0,
    blockedAuth: 0,
    invalid: 0,
    skipped: 0,
    items: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const buildBatchForm = (): FormData => {
  const form = new FormData();
  form.set("mission", JSON.stringify({
    missionType: "amazon_invoice_upload_batch",
    marketplace: "AE",
    sellerCentralEntryUrl: "https://sellercentral.amazon.ae/home",
    sourceKind: "filename_order_id",
    sourceSystem: "local-ui",
    requestId: "batch-request-test-1",
  }));
  form.append("invoicePdfs", new Blob(["%PDF-1.4\n"], { type: "application/pdf" }), "403-7307700-7597913.pdf");
  return form;
};

export const postLocalBatchStart = (rootUrl: string, localBaseUrl: string): Promise<Response> =>
  fetch(`${rootUrl}/api/plugins/amazon-invoice-upload/batch/start`, {
    method: "POST",
    headers: { Origin: localBaseUrl },
    body: buildBatchForm(),
  });

export const getLocalBatchRoute = (rootUrl: string, localBaseUrl: string, path: string): Promise<Response> =>
  fetch(`${rootUrl}${path}`, { headers: { Origin: localBaseUrl } });

export const postExternalBatchStart = (rootUrl: string, externalOrigin: string, apiKey: string): Promise<Response> =>
  fetch(`${rootUrl}/api/plugins/amazon-invoice-upload/batch/start`, {
    method: "POST",
    headers: { Origin: externalOrigin, "X-GrassEye-Agent-Key": apiKey },
    body: buildBatchForm(),
  });
