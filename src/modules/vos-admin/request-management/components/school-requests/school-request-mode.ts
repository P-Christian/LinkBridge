// Client-side mode mirror for the school-request surfaces. The server page
// passes the gate value as a prop; client code never imports the server-only
// gate module. Shared here so columns and the action controller agree on the
// same vocabulary without importing the composing tab.
export type SchoolRequestsMode = "legacy" | "attendance" | "opt-in" | "frozen";
