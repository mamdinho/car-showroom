export function getAuthContext(event) {
    // For HTTP API + Cognito JWT Authorizer, claims are under requestContext
    const claims = event?.requestContext?.authorizer?.jwt?.claims ||
        event?.requestContext?.authorizer?.claims ||
        {};
    const groups = (claims["cognito:groups"] || claims["cognito:groups[]"] || [])
        .toString()
        .split(",")
        .filter(Boolean);
    return {
        userId: claims["sub"],
        email: claims["email"],
        isAdmin: groups.includes("admin")
    };
}
