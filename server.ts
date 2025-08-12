// server.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { cors } from "@elysiajs/cors";
import { Elysia, t } from "elysia";
import * as schema from "./db/schema";
import { urlsTable } from "./db/schema";
import { eq, and } from "drizzle-orm";

// Types
interface UrlItem {
  id: string;
  name: string;
  mainUrl: string;
  subUrls: Record<string, string>;
}

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Create postgres client
const client = postgres(connectionString, { prepare: false });
const db = drizzle(client, { schema });

async function initializeDatabase() {
  try {
    console.log("🔄 Connecting to database...");

    // Use postgres.js client directly for test query
    await client`SELECT 1`;

    console.log("✅ Database connection successful");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    throw error;
  }
}

// Helper functions
function generateId(): string {
  return crypto.randomUUID();
}

// Create Elysia app
const app = new Elysia()
  .use(
    cors({
      origin: true, // Allow all origins in development
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  )

  // Health check
  .get("/health", async () => {
    try {
      // Test database connection
      await db.select().from(urlsTable).limit(1);
      return {
        status: "ok",
        timestamp: new Date().toISOString(),
        database: "connected",
      };
    } catch (error) {
      return {
        status: "error",
        timestamp: new Date().toISOString(),
        database: "disconnected",
        error: "Database connection failed",
      };
    }
  })

  // Get all URLs (only non-deleted)
  .get("/api/urls", async () => {
    try {
      const urls = await db
        .select()
        .from(urlsTable)
        .where(eq(urlsTable.isDeleted, false))
        .orderBy(urlsTable.name);
      return {
        success: true,
        data: urls,
      };
    } catch (error) {
      console.error("Error fetching URLs:", error);
      return {
        success: false,
        error: "Failed to fetch URLs",
      };
    }
  })

  // Get single URL by ID (only non-deleted)
  .get("/api/urls/:id", async ({ params: { id } }) => {
    try {
      const urls = await db
        .select()
        .from(urlsTable)
        .where(and(eq(urlsTable.id, id), eq(urlsTable.isDeleted, false)))
        .limit(1);

      if (urls.length === 0) {
        return {
          success: false,
          error: "URL not found",
        };
      }

      return {
        success: true,
        data: urls[0],
      };
    } catch (error) {
      console.error("Error fetching URL:", error);
      return {
        success: false,
        error: "Failed to fetch URL",
      };
    }
  })

  // Create new URL
  .post(
    "/api/urls",
    async ({ body }) => {
      try {
        const {
          name,
          mainUrl,
          subUrls = {},
        } = body as {
          name: string;
          mainUrl: string;
          subUrls?: Record<string, string>;
        };

        if (!name || !mainUrl) {
          return {
            success: false,
            error: "Name and mainUrl are required",
          };
        }

        const id = generateId();
        const newUrl = {
          id,
          name,
          mainUrl,
          subUrls,
          isDeleted: false,
        };

        await db.insert(urlsTable).values(newUrl);

        return {
          success: true,
          data: newUrl,
        };
      } catch (error) {
        console.error("Error creating URL:", error);
        return {
          success: false,
          error: "Failed to create URL",
        };
      }
    },
    {
      body: t.Object({
        name: t.String(),
        mainUrl: t.String(),
        subUrls: t.Optional(t.Record(t.String(), t.String())),
      }),
    }
  )

  // Update URL
  .put(
    "/api/urls/:id",
    async ({ params: { id }, body }) => {
      try {
        const {
          name,
          mainUrl,
          subUrls = {},
        } = body as {
          name: string;
          mainUrl: string;
          subUrls?: Record<string, string>;
        };

        if (!name || !mainUrl) {
          return {
            success: false,
            error: "Name and mainUrl are required",
          };
        }

        // Check if URL exists and is not deleted
        const existing = await db
          .select()
          .from(urlsTable)
          .where(and(eq(urlsTable.id, id), eq(urlsTable.isDeleted, false)))
          .limit(1);
        if (existing.length === 0) {
          return {
            success: false,
            error: "URL not found",
          };
        }

        const updatedUrl = {
          id,
          name,
          mainUrl,
          subUrls,
        };

        await db
          .update(urlsTable)
          .set({
            name,
            mainUrl,
            subUrls,
            updatedAt: new Date(),
          })
          .where(eq(urlsTable.id, id));

        return {
          success: true,
          data: updatedUrl,
        };
      } catch (error) {
        console.error("Error updating URL:", error);
        return {
          success: false,
          error: "Failed to update URL",
        };
      }
    },
    {
      body: t.Object({
        name: t.String(),
        mainUrl: t.String(),
        subUrls: t.Optional(t.Record(t.String(), t.String())),
      }),
    }
  )

  // Delete URL
  .delete("/api/urls/:id", async ({ params: { id } }) => {
    try {
      // soft delete
      await db
        .update(urlsTable)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
        })
        .where(eq(urlsTable.id, id));

      return {
        success: true,
        message: "URL deleted successfully",
      };
    } catch (error) {
      console.error("Error deleting URL:", error);
      return {
        success: false,
        error: "Failed to delete URL",
      };
    }
  })

  // Handle 404
  .onError(({ code, error, set }) => {
    if (code === "NOT_FOUND") {
      set.status = 404;
      return {
        success: false,
        error: "Endpoint not found",
      };
    }

    console.error("Server error:", error);
    set.status = 500;
    return {
      success: false,
      error: "Internal server error",
    };
  });

await initializeDatabase();

// Just export the app for Vercel to handle
export default app;
