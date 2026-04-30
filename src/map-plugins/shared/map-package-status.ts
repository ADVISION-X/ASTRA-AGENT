export const MAP_PACKAGE_LIFECYCLE_STATUSES = ["draft", "quarantined", "active", "disabled", "rolled_back"] as const;
export const MAP_PACKAGE_APPROVAL_STATUSES = ["draft", "quarantined", "approved", "rejected"] as const;

export type MapPackageLifecycleStatus = (typeof MAP_PACKAGE_LIFECYCLE_STATUSES)[number];
export type MapPackageApprovalStatus = (typeof MAP_PACKAGE_APPROVAL_STATUSES)[number];
