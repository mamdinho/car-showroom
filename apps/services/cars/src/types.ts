import { z } from "zod";

export const CarSchema = z.object({
  carId: z.string().uuid().optional(),        // created on POST
  brand: z.string().min(1),
  model: z.string().min(1),
  price: z.number().nonnegative(),
  year: z.number().int().min(1950).max(new Date().getFullYear() + 1),
  specs: z
    .object({
      engine: z.string().optional(),
      fuel: z.string().optional(),
      transmission: z.string().optional()
    })
    .partial()
    .optional()
});

export type Car = z.infer<typeof CarSchema>;
