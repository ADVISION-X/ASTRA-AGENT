export const MAP_PACKAGE_LIFECYCLE_STATUSES = ["draft", "quarantined", "active", "disabled", "rolled_back"] as const;
export const MAP_PACKAGE_ACTIVATION_GATE_STATUSES = ["draft", "quarantined", "gate_passed", "rejected"] as const;

export type MapPackageLifecycleStatus = (typeof MAP_PACKAGE_LIFECYCLE_STATUSES)[number];
export type MapPackageActivationGateStatus = (typeof MAP_PACKAGE_ACTIVATION_GATE_STATUSES)[number];
