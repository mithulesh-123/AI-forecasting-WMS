export const MOVEMENT_TYPES = ["IN", "OUT", "TRANSFER", "ADJUSTMENT", "RETURN"] as const;
export type MovementTypeValue = (typeof MOVEMENT_TYPES)[number];

export const DISPATCH_STATUSES = ["PENDING", "PROCESSING", "READY", "DISPATCHED", "CANCELLED"] as const;
export type DispatchStatusValue = (typeof DISPATCH_STATUSES)[number];

export const FORECAST_HORIZONS = [7, 14, 30] as const;
export type ForecastHorizonDays = (typeof FORECAST_HORIZONS)[number];

export const ROLES = ["ADMIN", "MANAGER", "WAREHOUSE_STAFF", "VIEWER"] as const;

/** Standard procurement lead time used by the reorder engine (days). */
export const LEAD_TIME_DAYS = 7;

/** Days of demand history considered by the statistical forecaster. */
export const HISTORY_WINDOW_DAYS = 90;
