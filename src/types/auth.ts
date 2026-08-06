import { z } from "zod";

// Zod schemas for validation
export const GroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  isLeader: z.boolean(),
});

export const UserSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  image: z.string().nullable(),
  groups: z.array(GroupSchema),
});

/**
 * Photon svarer med det ene appen faktisk bruker: er brukeren leder i Index?
 *
 * Lepton svarte med en tabell over alle Django-modeller og read/write per
 * modell. Photons rettigheter er navngitte strenger med scope, og ingenting
 * her brukte tabellen til annet enn Index-sjekken.
 */
export const PermissionSchema = z.object({
  isIndexLeader: z.boolean(),
  groups: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      isLeader: z.boolean(),
    })
  ),
});

export const AuthSchema = z.object({
  user: UserSchema,
  permissions: PermissionSchema,
});

// TypeScript types
export type Group = z.infer<typeof GroupSchema>;
export type User = z.infer<typeof UserSchema>;
export type Permission = z.infer<typeof PermissionSchema>;
export type Auth = z.infer<typeof AuthSchema>;

// Login credentials
export type LoginCredentials = {
  username: string;
  password: string;
};

// API response types
export type LoginResponse = {
  token: string;
};
