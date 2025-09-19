import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});

const USERS_TABLE = process.env.USERS_TABLE!;
const IMAGES_BUCKET = process.env.IMAGES_BUCKET!;

// -------------- helpers --------------
function json(status: number, data: any) {
  return {
    statusCode: status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  };
}
const bad = (m: string) => json(400, { error: m });
const forb = () => json(403, { error: "forbidden" });

function toArrayFlexible(v: any): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") {
    const s = v.trim();
    if (s.startsWith("[") && s.endsWith("]")) {
      try {
        const a = JSON.parse(s.replace(/'/g, '"'));
        if (Array.isArray(a)) return a.map(String);
      } catch {}
    }
    return s.split(/[,\s]+/).map(t => t.trim()).filter(Boolean);
  }
  return [String(v)];
}

function getAuthContext(event: any) {
  const claims =
    event?.requestContext?.authorizer?.jwt?.claims ||
    event?.requestContext?.authorizer?.claims ||
    {};
  const rawGroups =
    claims["cognito:groups"] ??
    claims["cognito:groups[]"] ??
    claims["groups"] ??
    claims["cognito_groups"];
  const groups = toArrayFlexible(rawGroups).map((g) =>
    g.replace(/^\[|\]$/g, "").toLowerCase()
  );
  return {
    userId: (claims["sub"] as string | undefined) ?? undefined,
    email: (claims["email"] as string | undefined) ?? undefined,
    isAdmin: groups.includes("admin"),
  };
}

// -------------- routes --------------

// GET /users/me
async function getMe(event: any) {
  const { userId, email } = getAuthContext(event);
  if (!userId) return forb();

  // Try fetch
  let r = await ddb.send(
    new GetCommand({ TableName: USERS_TABLE, Key: { userId } })
  );

  // If not found, upsert a minimal record
  if (!r.Item) {
    const item = {
      type: "user",
      userId,
      email: email ?? null,
      name: null as string | null,
      phone: null as string | null,
      status: null as string | null,
      avatarKey: null as string | null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await ddb.send(
        new PutCommand({
          TableName: USERS_TABLE,
          Item: item,
          ConditionExpression: "attribute_not_exists(userId)",
        })
      );
      r = { Item: item } as any;
    } catch (e) {
      // race condition or other: refetch
      r = await ddb.send(
        new GetCommand({ TableName: USERS_TABLE, Key: { userId } })
      );
    }
  }

  return json(200, r.Item);
}

// PUT /users/me
async function updateMe(event: any) {
  const { userId } = getAuthContext(event);
  if (!userId) return forb();

  let body: any;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return bad("invalid json");
  }

  // Allow only these fields to be updated by the user
  const allowed = ["name", "phone", "status", "avatarKey"] as const;
  const updates: Record<string, any> = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, k)) updates[k] = body[k];
  }

  if (Object.keys(updates).length === 0) {
    return bad("no fields to update");
  }

  // Build UpdateExpression safely (name/status are reserved words)
  const names: Record<string, string> = {};
  const values: Record<string, any> = {};
  const sets: string[] = [];

  for (const [k, v] of Object.entries(updates)) {
    const nk = `#${k}`;
    const vk = `:${k}`;
    names[nk] = k; // alias
    values[vk] = v;
    sets.push(`${nk} = ${vk}`);
  }

  // always update updatedAt
  names["#updatedAt"] = "updatedAt";
  values[":updatedAt"] = new Date().toISOString();
  sets.push("#updatedAt = :updatedAt");

  const r = await ddb.send(
    new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: "SET " + sets.join(", "),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: "ALL_NEW",
      ConditionExpression: "attribute_exists(userId)",
    })
  );

  return json(200, r.Attributes);
}

// POST /users/me/avatar-upload-url
async function avatarUploadUrl(event: any) {
  const { userId } = getAuthContext(event);
  if (!userId) return forb();

  let body: any;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return bad("invalid json");
  }
  const contentType = (body.contentType as string | undefined) ?? "image/jpeg";
  const ext = (contentType.split("/")[1] || "jpg").toLowerCase();
  const key = `images/users/${userId}/avatar.${ext}`;

  const cmd = new PutObjectCommand({
    Bucket: IMAGES_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 60 * 5 });

  return json(200, { uploadUrl, key });
}

// -------------- tiny router --------------
export const handler = async (event: any) => {
  try {
    const method = event.requestContext?.http?.method;
    const path = event.requestContext?.http?.path;

    const key = `${method} ${path}`;
    switch (key) {
      case "GET /users/me":
        return await getMe(event);
      case "PUT /users/me":
        return await updateMe(event);
      case "POST /users/me/avatar-upload-url":
        return await avatarUploadUrl(event);
      default:
        return json(404, { error: "route_not_found", key });
    }
  } catch (err: any) {
    console.error("USERS_SERVICE_UNHANDLED", err);
    return json(500, { error: "internal", message: err?.message || String(err) });
  }
};
