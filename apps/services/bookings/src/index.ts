import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const BOOKINGS_TABLE = process.env.BOOKINGS_TABLE!;
const CARS_TABLE = process.env.CARS_TABLE || "";

function json(status: number, data: any) {
  return { statusCode: status, headers: { "content-type": "application/json" }, body: JSON.stringify(data) };
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
  const claims = event?.requestContext?.authorizer?.jwt?.claims
              || event?.requestContext?.authorizer?.claims
              || {};
  const rawGroups = claims["cognito:groups"] ?? claims["cognito:groups[]"] ?? claims["groups"] ?? claims["cognito_groups"];
  const groups = toArrayFlexible(rawGroups).map(g => g.replace(/^\[|\]$/g, "").toLowerCase());
  return { userId: claims["sub"] as string | undefined, isAdmin: groups.includes("admin") };
}

function isIsoDateTime(s: any): boolean {
  if (typeof s !== "string") return false;
  const ok = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(s);
  if (!ok) return false;
  return !Number.isNaN(Date.parse(s));
}

// POST /bookings
async function createBooking(event: any) {
  const { userId } = getAuthContext(event);
  if (!userId) return forb();

  let body: any; try { body = JSON.parse(event.body || "{}"); } catch { return bad("invalid json"); }
  const carId = body.carId as string | undefined;
  const slotTime = body.slotTime as string | undefined;

  if (!carId) return bad("carId is required");
  if (!slotTime || !isIsoDateTime(slotTime)) return bad("slotTime must be ISO UTC, e.g. 2025-09-08T21:00:00Z");

  if (CARS_TABLE) {
    try {
      const g = await ddb.send(new GetCommand({ TableName: CARS_TABLE, Key: { carId } }));
      if (!g.Item) return bad("unknown carId");
    } catch (e) {
      console.log("WARN: car existence check failed:", e);
    }
  }

  const bookingId = randomUUID();
  const item = {
    type: "booking",
    bookingId,
    userId,
    carId,
    slotTime,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  await ddb.send(new PutCommand({
    TableName: BOOKINGS_TABLE,
    Item: item,
    ConditionExpression: "attribute_not_exists(bookingId)",
  }));

  return json(201, item);
}

// GET /bookings/me
async function listMyBookings(event: any) {
  const { userId } = getAuthContext(event);
  if (!userId) return forb();

  const r = await ddb.send(new ScanCommand({
    TableName: BOOKINGS_TABLE,
    FilterExpression: "#uid = :u",
    ExpressionAttributeNames: { "#uid": "userId" },
    ExpressionAttributeValues: { ":u": userId },
    Limit: 200,
  }));
  return json(200, r.Items || []);
}

// PATCH /bookings/{id}
async function updateBooking(event: any) {
  const { userId, isAdmin } = getAuthContext(event);
  if (!userId) return forb();

  const id = event?.pathParameters?.id;
  if (!id) return bad("missing id");

  let body: any; try { body = JSON.parse(event.body || "{}"); } catch { return bad("invalid json"); }
  const status = body.status as string | undefined;
  if (!status) return bad("status is required");

  const names: Record<string, string> = { "#status": "status", "#ua": "updatedAt" };
  const values: Record<string, any> = { ":status": status, ":ua": new Date().toISOString() };
  const setExpr = "SET #status = :status, #ua = :ua";

  const cond = isAdmin ? "attribute_exists(bookingId)" : "attribute_exists(bookingId) AND userId = :u";
  if (!isAdmin) values[":u"] = userId;

  const r = await ddb.send(new UpdateCommand({
    TableName: BOOKINGS_TABLE,
    Key: { bookingId: id },
    UpdateExpression: setExpr,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ConditionExpression: cond,
    ReturnValues: "ALL_NEW",
  }));

  return json(200, r.Attributes);
}

// ---- router (fix: do NOT normalize /bookings/me) ----
export const handler = async (event: any) => {
  try {
    const method: string | undefined = event.requestContext?.http?.method;
    const path: string | undefined = event.requestContext?.http?.path;

    // Only turn /bookings/<id> into /bookings/{id} if the segment is NOT "me"
    const norm =
      path && path.startsWith("/bookings/") && path !== "/bookings/me"
        ? "/bookings/{id}"
        : path;

    const key = `${method} ${norm}`;
    switch (key) {
      case "POST /bookings":
        return await createBooking(event);
      case "GET /bookings/me":
        return await listMyBookings(event);
      case "PATCH /bookings/{id}":
        return await updateBooking(event);
      default:
        return json(404, { error: "route_not_found", key });
    }
  } catch (err: any) {
    console.error("UNHANDLED", err);
    return json(500, { error: "internal", message: err?.message || String(err) });
  }
};
