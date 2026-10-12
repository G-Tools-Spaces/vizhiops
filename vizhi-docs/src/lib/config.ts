/**
 * The two addresses this site points at.
 *
 * The docs app performs no operation of its own: when a reader wants to *use*
 * Vizhi, every path leads to the console. The API base URL appears only inside
 * code samples, so a reader can copy one and run it unchanged.
 */

export const CONSOLE_URL =
  process.env.NEXT_PUBLIC_CONSOLE_URL ?? "http://localhost:3000";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/** Every endpoint lives under this prefix. */
export const API_PREFIX = "/v1";

/** Where the console's sign-in page lives. */
export const CONSOLE_LOGIN_URL = `${CONSOLE_URL.replace(/\/$/, "")}/login`;
