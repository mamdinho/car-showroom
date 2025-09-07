export function getAuthContext(event: any) {
  const claims =
    event?.requestContext?.authorizer?.jwt?.claims ||
    event?.requestContext?.authorizer?.claims || {};
  const groups: string[] = (claims["cognito:groups"] || claims["cognito:groups[]"] || "")
    .toString()
    .split(",")
    .filter(Boolean);
  return {
    userId: claims["sub"] as string | undefined,
    email: claims["email"] as string | undefined,
    isAdmin: groups.includes("admin")
  };
}
