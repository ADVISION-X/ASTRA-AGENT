import { PRODUCT_DISCOVERY_ROUTE_PLAN } from "./product-discovery-route-plan.v1.js";
import type { RoutePlan } from "./route-plan.schema.js";

const ROUTE_PLANS = [PRODUCT_DISCOVERY_ROUTE_PLAN] as const;

export const listRoutePlans = (): readonly RoutePlan[] => ROUTE_PLANS;

export const findRoutePlanById = (routePlanId: string | null | undefined): RoutePlan | null =>
  routePlanId ? ROUTE_PLANS.find((plan) => plan.routePlanId === routePlanId) ?? null : null;

export {
  PRODUCT_DISCOVERY_NEGATIVE_ROUTE_LABEL,
  PRODUCT_DISCOVERY_OUTCOME_OPTIONS,
  PRODUCT_DISCOVERY_POSITIVE_ROUTE_LABEL,
  PRODUCT_DISCOVERY_ROUTE_PLAN_ID,
  PRODUCT_DISCOVERY_ROUTE_LABELS,
} from "./product-discovery-route-plan.constants.js";
export { PRODUCT_DISCOVERY_ROUTE_PLAN } from "./product-discovery-route-plan.v1.js";

export type { RoutePlan, RoutePlanOutcomeOption } from "./route-plan.schema.js";
