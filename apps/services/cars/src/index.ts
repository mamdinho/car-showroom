import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { CarSchema } from "./types.js";
import { getAuthContext } from "./auth.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const TABLE = process.env.CARS_TABLE!;
const IMAGES_BUCKET = process.env.IMAGES_BUCKET!;

function json(statusCode: number, data: any) {
  return { statusCode, body: JSON.stringify(data), headers: { "content-type": "application/json" } };
}
function badRequest(msg: string) { return json(400, { error: msg }); }
function forbidden() { return json(403, { error: "forbidden" }); }
function notFound() { return json(404, { error: "not found" }); }

export const listCars = async (event: any) => {
  const qs = event.queryStringParameters || {};
  // MVP: simple Scan; can be optimized later to Query by brand/price/year GSIs
  const res = await ddb.send(new ScanCommand({ TableName: TABLE, Limit: 100 }));
  return json(200, res.Items || []);
};

export const getCar = async (event: any) => {
  const id = event?.pathParameters?.id;
  if (!id) return badRequest("missing id");
  const res = await ddb.send(new GetCommand({ TableName: TABLE, Key: { carId: id } }));
  if (!res.Item) return notFound();
  return json(200, res.Item);
};

export const createCar = async (event: any) => {
  const { isAdmin } = getAuthContext(event);
  if (!isAdmin) return forbidden();

  let body: any;
  try { body = JSON.parse(event.body || "{}"); } catch { return badRequest("invalid json"); }
  const parsed = CarSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.errors.map(e => e.message).join(", "));

  const carId = randomUUID();
  const item = { ...parsed.data, carId };
  await ddb.send(new PutCommand({ TableName: TABLE, Item: item, ConditionExpression: "attribute_not_exists(carId)" }));
  return json(201, item);
};

export const updateCar = async (event: any) => {
  const { isAdmin } = getAuthContext(event);
  if (!isAdmin) return forbidden();
  const id = event?.pathParameters?.id;
  if (!id) return badRequest("missing id");
  let body: any;
  try { body = JSON.parse(event.body || "{}"); } catch { return badRequest("invalid json"); }

  const parsed = CarSchema.partial().safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.errors.map(e => e.message).join(", "));

  // Simple update: replace attributes present
  const exprNames: Record<string,string> = {};
  const exprValues: Record<string, any> = {};
  const sets: string[] = [];
  for (const [k, v] of Object.entries(parsed.data)) {
    const nameKey = "#" + k;
    const valueKey = ":" + k;
    exprNames[nameKey] = k;
    exprValues[valueKey] = v;
    sets.push(`${nameKey} = ${valueKey}`);
  }
  if (sets.length === 0) return badRequest("no fields to update");

  const res = await ddb.send(new UpdateCommand({
    TableName: TABLE,
    Key: { carId: id },
    UpdateExpression: "SET " + sets.join(", "),
    ExpressionAttributeNames: exprNames,
    ExpressionAttributeValues: exprValues,
    ReturnValues: "ALL_NEW"
  }));
  return json(200, res.Attributes);
};

export const deleteCar = async (event: any) => {
  const { isAdmin } = getAuthContext(event);
  if (!isAdmin) return forbidden();
  const id = event?.pathParameters?.id;
  if (!id) return badRequest("missing id");
  await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { carId: id } }));
  return json(204, {});
};

export const imageUploadUrl = async (event: any) => {
  const { isAdmin } = getAuthContext(event);
  if (!isAdmin) return forbidden();
  const id = event?.pathParameters?.id;
  if (!id) return badRequest("missing id");

  const key = `cars/${id}/${randomUUID()}.jpg`;
  const command = new PutObjectCommand({ Bucket: IMAGES_BUCKET, Key: key, ContentType: "image/jpeg" });

  const url = await getSignedUrl(s3, command, { expiresIn: 60 * 5 });
  return json(200, { uploadUrl: url, key });
};
