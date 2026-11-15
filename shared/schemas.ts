// zod schemas shared by client and server.
import { z } from "zod";
import { config } from "./gameData";

const { usernameMin, usernameMax, passwordMin, passwordMax } = config.auth;
const teamMax = config.starter.activeSlots + config.starter.benchSlots;

export const usernameSchema = z
  .string()
  .min(usernameMin, `Username must be ${usernameMin}–${usernameMax} characters.`)
  .max(usernameMax, `Username must be ${usernameMin}–${usernameMax} characters.`)
  .regex(/^[A-Za-z0-9_]+$/, "Username can only use letters, numbers and underscores.");

export const passwordSchema = z
  .string()
  .min(passwordMin, `Password must be ${passwordMin}–${passwordMax} characters.`)
  .max(passwordMax, `Password must be ${passwordMin}–${passwordMax} characters.`);

export const credentialsSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});
export type Credentials = z.infer<typeof credentialsSchema>;

const idSchema = z.string().min(1).max(64);

export const ownedCritterSchema = z.object({
  uid: idSchema,
  line: idSchema,
  stageId: idSchema,
  level: z.number().int().min(1).max(999),
  xp: z.number().int().min(0),
  hp: z.number().int().min(0),
});

export const mapNodeSchema = z.object({
  id: idSchema,
  floor: z.number().int().min(1).max(50),
  column: z.number().int().min(0).max(16),
  room: z.enum(["normal", "elite", "boss", "shop", "rest", "event"]),
  next: z.array(idSchema).max(8),
});

export const runSaveSchema = z.object({
  saveVersion: z.literal(1),
  seed: z.string().min(1).max(64),
  rngState: z.number().int(),
  floor: z.number().int().min(1).max(50),
  act: z.number().int().min(1).max(5),
  biomeId: idSchema,
  biomeHistory: z.array(idSchema).max(8),
  map: z.array(mapNodeSchema).max(64),
  currentNodeId: idSchema.nullable(),
  team: z.object({
    active: z.array(ownedCritterSchema).max(config.starter.activeSlots),
    bench: z.array(ownedCritterSchema).max(config.starter.benchSlots),
  }),
  acorns: z.number().int().min(0),
  potions: z.array(idSchema.nullable()).max(8),
  relics: z.array(idSchema).max(128),
  druidPowers: z.array(idSchema).max(16),
  pendingEggs: z.array(z.object({ hatchInRooms: z.number().int().min(0) })).max(teamMax).optional(),
});

export const putRunSchema = z.object({
  saveVersion: z.literal(1),
  state: runSaveSchema,
});

export const unlockSchema = z.object({ critterLine: idSchema });
export const badgeSchema = z.object({ badgeId: idSchema });
