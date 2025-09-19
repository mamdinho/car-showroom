import { Amplify } from "aws-amplify";

const region = process.env.NEXT_PUBLIC_REGION;
const userPoolId = process.env.NEXT_PUBLIC_USER_POOL_ID!;
const userPoolClientId = process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID!;
const identityPoolId = process.env.NEXT_PUBLIC_IDENTITY_POOL_ID; // optional

if (!userPoolId || !userPoolClientId) {
  console.warn("⚠️ Missing NEXT_PUBLIC_USER_POOL_ID or NEXT_PUBLIC_USER_POOL_CLIENT_ID");
}

/**
 * Auth config for Amplify v6
 * - Only include optional keys if defined
 */
const auth = {
  Cognito: {
    userPoolId,
    userPoolClientId,
    loginWith: { email: true, username: false, phone: false },
  },
  ...(region ? { region } : {}),
  ...(identityPoolId ? { identityPoolId } : {}),
} as const;

Amplify.configure({ Auth: auth });
