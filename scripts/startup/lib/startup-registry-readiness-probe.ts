type ReadinessResult = {
  status: "ready";
  ownerResponsible: "startup-entrypoint";
  refs: string[];
  failureReason: null;
  actionableMessage: null;
};

const result: ReadinessResult = {
  status: "ready",
  ownerResponsible: "startup-entrypoint",
  refs: ["mainline=amazon-invoice-upload", "architecture=job-flow"],
  failureReason: null,
  actionableMessage: null,
};

process.stdout.write(`${JSON.stringify(result)}\n`);
