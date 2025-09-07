import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand, TransactWriteCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { CreateBookingSchema, UpdateBookingSchema } from "./types.js";
import { getAuthContext } from "./auth.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const BOOKINGS_TABLE = process.env.BOOKINGS_TABLE!;
const LOCK_PREFIX = "LOCK#"; // lock rows prevent double-booking

function json(status: number, data: any) {
  return { statusCode: status, body: JSON.stringify(data), headers: { "content-type": "application/json" } };
}
const bad = (m: string) => json(400, { error: m });
const forb = () => json(403, { error: "forbidden" });
const notf = () => json(404, { error: "not found" });

async function createBooking(event: any) {
  const { userId } = getAuthContext(event);
  if (!userId) return forb();

  let body: any;
  try { body = JSON.parse(event.body || "{}"); } catch { return bad("invalid json"); }
  const parsed = CreateBookingSchema.safeParse(body);
  if (!parsed.success) return bad(parsed.error.issues.map(i => i.message).join(", "));
  const { carId, slotTime } = parsed.data;

  const bookingId = randomUUID();
  const lockId = `${LOCK_PREFIX}${carId}#${slotTime}`;

  // Use a transaction: create a lock row (ensures uniqueness per car+slot) and the booking row
  try {
    await ddb.send(new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: BOOKINGS_TABLE,
            Item: { bookingId: lockId, carId, slotTime, type: "lock" },
            ConditionExpression: "attribute_not_exists(bookingId)"
          }
        },
        {
          Put: {
            TableName: BOOKINGS_TABLE,
            Item: { bookingId, userId, carId, slotTime, status: "pending", type: "booking", createdAt: new Date().toISOString() },
            ConditionExpression: "attribute_not_exists(bookingId)"
          }
        }
      ]
    }));
  } catch (e: any) {
    // ConditionalCheckFailedException -> slot already taken
    return json(409, { error: "slot_unavailable" });
  }

  return json(201, { bookingId, userId, carId, slotTime, status: "pending" });
}

async function listMyBookings(event: any) {
  const { userId } = getAuthContext(event);
  if (!userId) return forb();

  // Prefer GSI "user-index" (PK=userId, SK=slotTime). If not present fallback to scan (not recommended).
  try {
    const r = await ddb.send(new QueryCommand({
      TableName: BOOKINGS_TABLE,
      IndexName: "user-index",
      KeyConditionExpression: "userId = :u",
      ExpressionAttributeValues: { ":u": userId }
    }));
    return json(200, (r.Items || []).filter(i => i.type !== "lock"));
  } catch {
    // Fallback (will cost more): scan & filter
    // const r = await ddb.send(new ScanCommand({ TableName: BOOKINGS_TABLE, FilterExpression: "userId = :u", ExpressionAttributeValues: { ":u": userId } }));
    // return json(200, r.Items || []);
    return json(500, { error: "user-index GSI missing" });
  }
}

async function updateBooking(event: any) {
  const { userId, isAdmin } = getAuthContext(event);
  if (!userId) return forb();

  const id = event?.pathParameters?.id;
  if (!id) return bad("missing id");

  let body: any;
  try { body = JSON.parse(event.body || "{}"); } catch { return bad("invalid json"); }
  const parsed = UpdateBookingSchema.safeParse(body);
  if (!parsed.success) return bad(parsed.error.issues.map(i => i.message).join(", "));
  const { status } = parsed.data;

  // Fetch booking
  const get = await ddb.send(new GetCommand({ TableName: BOOKINGS_TABLE, Key: { bookingId: id } }));
  const item = get.Item;
  if (!item || item.type === "lock") return notf();

  // Authorization rules:
  // - admin can set any status
  // - owner can set status to "cancelled" only
  if (!isAdmin && !(item.userId === userId && status === "cancelled")) return forb();

  // Update status
  const updated = await ddb.send(new UpdateCommand({
    TableName: BOOKINGS_TABLE,
    Key: { bookingId: id },
    UpdateExpression: "SET #s = :s",
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: { ":s": status },
    ReturnValues: "ALL_NEW"
  }));

  // If cancelled, free the slot by deleting the lock row
  if (status === "cancelled") {
    const lockId = `${LOCK_PREFIX}${item.carId}#${item.slotTime}`;
    try { await ddb.send(new DeleteCommand({ TableName: BOOKINGS_TABLE, Key: { bookingId: lockId } })); } catch {}
  }

  return json(200, updated.Attributes);
}

const routes: Record<string, (e: any) => Promise<any>> = {
  "POST /bookings": createBooking,
  "GET /bookings/me": listMyBookings,
  "PATCH /bookings/{id}": updateBooking
};

export const handler = async (event: any) => {
  const method = event.requestContext?.http?.method;
  const path = event.requestContext?.http?.path;

  // normalize dynamic id for PATCH /bookings/{id}
  let normPath = path;
  if (/^\/bookings\/[^/]+$/.test(path)) normPath = "/bookings/{id}";

  const key = `${method} ${normPath}`;
  const fn = routes[key];
  if (!fn) return json(404, { error: "route_not_found", key });

  try {
    return await fn(event);
  } catch (e: any) {
    console.error(e);
    return json(500, { error: "internal", message: e?.message });
  }
};
