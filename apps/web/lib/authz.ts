/**
 * Checks if an ID token belongs to an admin user.
 * Looks for the "cognito:groups" claim containing "admin".
 */
export function isAdminFromIdToken(idToken?: string): boolean {
  if (!idToken) return false;

  try {
    // Decode the JWT without verifying
    const payload = JSON.parse(
      Buffer.from(idToken.split(".")[1], "base64").toString("utf-8")
    );

    const groups: string[] = (
      payload["cognito:groups"] ||
      payload["cognito:groups[]"] ||
      []
    );

    return Array.isArray(groups)
      ? groups.includes("admin")
      : String(groups).split(",").includes("admin");
  } catch {
    return false;
  }
}
