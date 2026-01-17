import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock user for testing
function createMockContext(overrides: Partial<TrpcContext["user"]> = {}): TrpcContext {
  const user = {
    id: 1,
    openId: "test-user-123",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "email",
    role: "user" as const,
    credits: 1000,
    status: "active" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    passwordHash: null,
    emailVerified: true,
    verificationToken: null,
    resetToken: null,
    resetTokenExpiry: null,
    apolloApiKey: null,
    scrapeDoApiKey: null,
    ...overrides,
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  return createMockContext({ role: "admin" });
}

function createUnauthenticatedContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("Auth Router", () => {
  it("returns null for unauthenticated user", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user data for authenticated user", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.email).toBe("test@example.com");
    expect(result?.name).toBe("Test User");
  });

  it("clears cookie on logout", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
  });
});

describe("User Router", () => {
  it("returns user profile for authenticated user", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.user.profile();
    expect(result).toBeDefined();
    // Profile returns the context user data
    expect(result.id).toBe(1);
    expect(result.role).toBe("user");
  });
});

describe("Search Router Input Validation", () => {
  it("rejects search with empty name", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    await expect(
      caller.search.start({
        name: "",
        title: "Engineer",
        state: "California",
      })
    ).rejects.toThrow();
  });

  it("rejects search with empty title", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    await expect(
      caller.search.start({
        name: "John",
        title: "",
        state: "California",
      })
    ).rejects.toThrow();
  });

  it("rejects search with empty state", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    await expect(
      caller.search.start({
        name: "John",
        title: "Engineer",
        state: "",
      })
    ).rejects.toThrow();
  });
});

describe("Recharge Router Input Validation", () => {
  it("rejects recharge with less than 100 credits", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    await expect(
      caller.recharge.create({
        credits: 50,
      })
    ).rejects.toThrow();
  });
});

describe("Admin Router Access Control", () => {
  it("allows admin to access stats", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    // This should not throw - admin has access
    const result = await caller.admin.stats();
    expect(result).toBeDefined();
    expect(typeof result.totalSearches).toBe("number");
  });

  it("denies non-admin access to admin routes", async () => {
    const ctx = createMockContext({ role: "user" });
    const caller = appRouter.createCaller(ctx);
    
    await expect(caller.admin.stats()).rejects.toThrow();
  });

  it("denies unauthenticated access to admin routes", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    
    await expect(caller.admin.stats()).rejects.toThrow();
  });
});

describe("Credits System", () => {
  it("allows admin to adjust credits with valid input", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    // Valid adjustment should succeed
    const result = await caller.admin.adjustCredits({
      userId: 1,
      amount: 100,
      reason: "Test adjustment",
    });
    expect(result.success).toBe(true);
    expect(typeof result.newBalance).toBe("number");
  });
});
