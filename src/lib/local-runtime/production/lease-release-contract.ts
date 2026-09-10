export type ProductionLeaseRelease =
  | Readonly<{
    reasonCode: "CAPABILITY_CHANGED_BEFORE_ACCEPT" | "LEASE_SAFETY_BUDGET_EXHAUSTED" | "LOCAL_CAPACITY_CHANGED";
    receiverCheckpoint: null;
    confirmedSubmit: null;
  }>
  | Readonly<{
    reasonCode: "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED";
    receiverCheckpoint: null;
    confirmedSubmit: null;
  }>;
