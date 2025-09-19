import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const TABLE = process.env.CARS_TABLE!;
const IMAGES_BUCKET = process.env.IMAGES_BUCKET!;

function json(statusCode: number, data: any) {
  return { statusCode, body: JSON.stringify(data), headers: { "content-type": "application/json" } };
}
const bad = (m: string) => json(400, { error: m });
const forb = () => json(403, { error: "forbidden" });
const notf = () => json(404, { error: "not found" });

function toArrayFlexible(v: any): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") {
    const s = v.trim();
    if (s.startsWith("[") && s.endsWith("]")) {
      try { const a = JSON.parse(s.replace(/'/g, '"')); if (Array.isArray(a)) return a.map(String); } catch {}
    }
    return s.split(/[,\s]+/).map(t => t.trim()).filter(Boolean);
  }
  return [String(v)];
}

function getAuthContext(event: any) {
  const claims = event?.requestContext?.authorizer?.jwt?.claims || event?.requestContext?.authorizer?.claims || {};
  const rawGroups = claims["cognito:groups"] ?? claims["cognito:groups[]"] ?? claims["groups"] ?? claims["cognito_groups"];
  const groups = toArrayFlexible(rawGroups).map(g => g.replace(/^\[|\]$/g, "").toLowerCase());
  return { userId: claims["sub"] as string | undefined, isAdmin: groups.includes("admin") };
}

async function listCars() {
  const r = await ddb.send(new ScanCommand({ TableName: TABLE, Limit: 100 }));
  return json(200, r.Items || []);
}

async function getCar(event: any) {
  const id = event?.pathParameters?.id;
  if (!id) return bad("missing id");
  const r = await ddb.send(new GetCommand({ TableName: TABLE, Key: { carId: id } }));
  if (!r.Item) return notf();
  return json(200, r.Item);
}

async function createCar(event: any) {
  const { isAdmin } = getAuthContext(event);
  if (!isAdmin) return forb();
  let body: any; try { body = JSON.parse(event.body || "{}"); } catch { return bad("invalid json"); }
  const carId = randomUUID();
  const item = { carId, ...body };
  await ddb.send(new PutCommand({ TableName: TABLE, Item: item, ConditionExpression: "attribute_not_exists(carId)" }));
  return json(201, item);
}

async function updateCar(event: any) {
  const { isAdmin } = getAuthContext(event);
  if (!isAdmin) return forb();
  const id = event?.pathParameters?.id;
  if (!id) return bad("missing id");
  let body: any; try { body = JSON.parse(event.body || "{}"); } catch { return bad("invalid json"); }

  const exprNames: Record<string,string> = {};
  const exprValues: Record<string, any> = {};
  const sets: string[] = [];
  for (const [k, v] of Object.entries(body)) {
    const nk = "#" + k, vk = ":" + k;
    exprNames[nk] = k; exprValues[vk] = v; sets.push(`${nk} = ${vk}`);
  }
  if (!sets.length) return bad("no fields to update");

  const r = await ddb.send(new UpdateCommand({
    TableName: TABLE, Key: { carId: id },
    UpdateExpression: "SET " + sets.join(", "),
    ExpressionAttributeNames: exprNames,
    ExpressionAttributeValues: exprValues,
    ReturnValues: "ALL_NEW"
  }));
  return json(200, r.Attributes);
}

async function deleteCar(event: any) {
  const { isAdmin } = getAuthContext(event);
  if (!isAdmin) return forb();
  const id = event?.pathParameters?.id;
  if (!id) return bad("missing id");
  await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { carId: id } }));
  return json(204, {});
}

// POST /cars/{id}/image-upload-url  body: { contentType?: string }
async function imageUploadUrl(event: any) {
  const { isAdmin } = getAuthContext(event);
  if (!isAdmin) return forb();
  const id = event?.pathParameters?.id;
  if (!id) return bad("missing id");

  let contentType = "application/octet-stream";
  try {
    const b = JSON.parse(event.body || "{}");
    if (typeof b.contentType === "string" && b.contentType.length < 128) contentType = b.contentType;
  } catch {}

  const ext = (contentType.split("/")[1] || "jpg").toLowerCase();
  const key = `images/cars/${id}/${randomUUID()}.${ext}`;

  const cmd = new PutObjectCommand({ Bucket: IMAGES_BUCKET, Key: key, ContentType: contentType });
  const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 60 * 5 });
  return json(200, { uploadUrl, key });
}

export const handler = async (event: any) => {
  const method = event.requestContext?.http?.method;
  const path   = event.requestContext?.http?.path;

  const norm = path?.replace(
    /^\/cars\/[^\/]+(\/image-upload-url)?$/,
    (m: string) => (m.includes("image-upload-url") ? "/cars/{id}/image-upload-url" : "/cars/{id}")
  );

  const key = `${method} ${norm || path}`;
  switch (key) {
    case "GET /cars": return await listCars();
    case "GET /cars/{id}": return await getCar(event);
    case "POST /cars": return await createCar(event);
    case "PUT /cars/{id}": return await updateCar(event);
    case "DELETE /cars/{id}": return await deleteCar(event);
    case "POST /cars/{id}/image-upload-url": return await imageUploadUrl(event);
    default: return json(404, { error: "route not found", key });
  }
};
