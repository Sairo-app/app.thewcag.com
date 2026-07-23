import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  usage: 0,
  execute: vi.fn(),
  insert: vi.fn(),
  insertedValues: vi.fn(),
  returning: vi.fn(),
}));

vi.mock("@/lib/schema", () => ({
  authSigninAttempts: { ipHash: "ip_hash", createdAt: "created_at" },
  verificationTokens: {
    identifier: "identifier",
    token: "token",
    expires: "expires",
  },
}));

vi.mock("@/lib/db", () => {
  const tx = {
    execute: boundary.execute,
    select: vi.fn(() => ({
      from: () => ({
        where: async () => [{ value: boundary.usage }],
      }),
    })),
    insert: boundary.insert.mockImplementation(() => ({
      values: (value: unknown) => {
        boundary.insertedValues(value);
        return { returning: boundary.returning };
      },
    })),
  };
  return { db: { transaction: (callback: (value: typeof tx) => unknown) => callback(tx) } };
});

import {
  createRateLimitedVerificationToken,
  reserveSignInAttempt,
} from "./auth-rate-limit";

describe("email sign-in abuse limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boundary.usage = 0;
    boundary.returning.mockResolvedValue([]);
  });

  it("blocks the sixth active email link before inserting its token", async () => {
    boundary.usage = 5;

    await expect(createRateLimitedVerificationToken({
      identifier: "victim@example.com",
      token: "sixth-token",
      expires: new Date(Date.now() + 60_000),
    })).rejects.toMatchObject({
      name: "SignInRateLimitError",
      message: "too_many_email_links",
    });

    expect(boundary.insert).not.toHaveBeenCalled();
    expect(boundary.insertedValues).not.toHaveBeenCalled();
  });

  it("creates a fifth token inside the guarded transaction", async () => {
    boundary.usage = 4;
    const token = {
      identifier: "victim@example.com",
      token: "fifth-token",
      expires: new Date(Date.now() + 60_000),
    };
    boundary.returning.mockResolvedValue([token]);

    await expect(createRateLimitedVerificationToken(token)).resolves.toEqual(token);
    expect(boundary.insertedValues).toHaveBeenCalledWith(token);
  });

  it("blocks an exhausted per-IP sign-in bucket without recording another attempt", async () => {
    boundary.usage = 10;
    const headers = new Headers({ "x-forwarded-for": "203.0.113.10" });

    await expect(reserveSignInAttempt(headers)).rejects.toMatchObject({
      message: "too_many_signin_attempts",
    });
    expect(boundary.insert).not.toHaveBeenCalled();
  });
});
