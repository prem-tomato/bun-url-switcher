// api/server.ts
import { drizzle } from "drizzle-orm/vercel-postgres";
import { migrate } from "drizzle-orm/vercel-postgres/migrator"; // Updated for vercel-postgres
import { sql } from "@vercel/postgres"; // Vercel client
import { cors } from "@elysiajs/cors";
import { Elysia, t } from "elysia";
import * as schema from "../db/schema";
import { urlsTable } from "../db/schema";
import { eq, and } from "drizzle-orm"; // Removed isNull as unused

// Types (unchanged)
interface UrlItem {
  id: string;
  name: string;
  mainUrl: string;
  subUrls: Record<string, string>;
}

// Database connection (uses env.POSTGRES_URL automatically)
const db = drizzle({ client: sql, schema });

// Run migrations and initialize (call once on startup)
let isInitialized = false;
async function initializeDatabase() {
  if (isInitialized) return;
  try {
    // The migration call has been removed from here.
    console.log("🔄 Initializing database connection...");

    // Seeding logic is okay to keep because of the check
    const existingUrls = await db.select().from(urlsTable).limit(1);
    if (existingUrls.length === 0) {
      console.log("📦 Seeding database with initial data...");
      // ... your seeding code ...
    } else {
      console.log("✅ Database already contains data, skipping seed");
    }

    isInitialized = true;
    console.log("✅ Database initialization complete!");
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    throw error; // Propagate error to stop the function from starting incorrectly
  }
}

// Helper functions (unchanged)
function generateId(): string {
  return crypto.randomUUID();
}

// Create Elysia app (unchanged except call init)
const app = new Elysia()
  .use(
    cors({
      origin: true,
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  )
  .onStart(async () => {
    await initializeDatabase(); // Run on app start
  })

  // Health check (updated to use new db)
  .get("/health", async () => {
    try {
      await db.execute(`SELECT 1`); // Test connection
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

if (process.env.VERCEL !== "1") {
  app.listen(Number(process.env.PORT) || 3002);
  console.log(
    `🚀 Server running at http://localhost:${process.env.PORT || 3002}`
  );
}

// Your types, db setup, initializeDatabase, app definition...

export default app.fetch;
