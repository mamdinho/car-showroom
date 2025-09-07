export function getAuthContext(event) {
    const claims = event?.requestContext?.authorizer?.jwt?.claims ||
        event?.requestContext?.authorizer?.claims || {};
    const groups = (claims["cognito:groups"] || claims["cognito:groups[]"] || "")
        .toString()
        .split(",")
        .filter(Boolean);
    return {
        userId: claims["sub"],
        email: claims["email"],
        isAdmin: groups.includes("admin")
    };
}
