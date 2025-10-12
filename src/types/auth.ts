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

export const PermissionSchema = z.record(
  z.string(),
  z.object({
    write: z.boolean(),
    read: z.boolean(),
    write_all: z.boolean().optional(),
    destroy: z.boolean().optional(),
  })
);

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
