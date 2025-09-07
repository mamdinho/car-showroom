import { z } from "zod";

export const CreateBookingSchema = z.object({
  carId: z.string().min(1),
  slotTime: z.string().datetime() // ISO string e.g. 2025-09-07T15:00:00Z
});

export const UpdateBookingSchema = z.object({
  status: z.enum(["pending", "confirmed", "cancelled"])
});

export type CreateBooking = z.infer<typeof CreateBookingSchema>;
export type UpdateBooking = z.infer<typeof UpdateBookingSchema>;
