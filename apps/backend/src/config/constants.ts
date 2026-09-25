/**
 * Fixed, rarely-changing knobs. Policy numbers (lodging caps, meal caps,
 * approval thresholds) do NOT live here — they live in the `policy_config`
 * table so they can change without a redeploy.
 */
export const APP_NAME = 'settle';

/** header the frontend sends to identify the acting user (auth stub) */
export const USER_HEADER = 'x-user';

/** correlation id header, echoed on every response */
export const REQUEST_ID_HEADER = 'x-request-id';

/** max size for an uploaded raw email / receipt image */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** claim must be submitted within N calendar days of return (policy 5.1) */
export const SUBMISSION_WINDOW_DAYS = 7;
