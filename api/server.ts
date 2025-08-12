import { sql } from "@vercel/postgres";
import { cors } from "@elysiajs/cors";
import { Elysia, t } from "elysia";

// Types
interface UrlItem {
  id: string;
  name: string;
  mainUrl: string;
  subUrls: Record<string, string>;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

interface CreateUrlData {
  name: string;
  mainUrl: string;
  subUrls?: Record<string, string>;
}

interface UpdateUrlData {
  name: string;
  mainUrl: string;
  subUrls?: Record<string, string>;
}

// Simple database connection test
async function testDatabaseConnection() {
  try {
    await sql`SELECT 1`;
    console.log("✅ Database connection successful");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
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
      origin: true,
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  )
  .onStart(async () => {
    await testDatabaseConnection();
  })

  // Health check
  .get("/health", async () => {
    try {
      await sql`SELECT 1`;
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
      const result = await sql`
        SELECT id, name, "mainUrl", "subUrls", "isDeleted", "createdAt", "updatedAt", "deletedAt"
        FROM urls 
        WHERE "isDeleted" = false 
        ORDER BY name ASC
      `;

      return {
        success: true,
        data: result.rows,
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
      const result = await sql`
        SELECT id, name, "mainUrl", "subUrls", "isDeleted", "createdAt", "updatedAt", "deletedAt"
        FROM urls 
        WHERE id = ${id} AND "isDeleted" = false
        LIMIT 1
      `;

      if (result.rows.length === 0) {
        return {
          success: false,
          error: "URL not found",
        };
      }

      return {
        success: true,
        data: result.rows[0],
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
        const { name, mainUrl, subUrls = {} } = body as CreateUrlData;

        if (!name || !mainUrl) {
          return {
            success: false,
            error: "Name and mainUrl are required",
          };
        }

        const id = generateId();

        const result = await sql`
          INSERT INTO urls (id, name, "mainUrl", "subUrls", "isDeleted", "createdAt", "updatedAt")
          VALUES (${id}, ${name}, ${mainUrl}, ${JSON.stringify(
          subUrls
        )}, false, ()NOW, ()NOW)
          RETURNING id, name, "mainUrl", "subUrls", "isDeleted", "createdAt", "updatedAt", "deletedAt"
        `;

        return {
          success: true,
          data: result.rows[0],
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
        const { name, mainUrl, subUrls = {} } = body as UpdateUrlData;

        if (!name || !mainUrl) {
          return {
            success: false,
            error: "Name and mainUrl are required",
          };
        }

        // Check if URL exists and is not deleted
        const checkResult = await sql`
          SELECT id FROM urls 
          WHERE id = ${id} AND "isDeleted" = false
          LIMIT 1
        `;

        if (checkResult.rows.length === 0) {
          return {
            success: false,
            error: "URL not found",
          };
        }

        const now = new Date();

        const result = await sql`
          UPDATE urls 
          SET 
            name = ${name},
            "mainUrl" = ${mainUrl},
            "subUrls" = ${JSON.stringify(subUrls)},
            "updatedAt" = ()NOW
          WHERE id = ${id}
          RETURNING id, name, "mainUrl", "subUrls", "isDeleted", "createdAt", "updatedAt", "deletedAt"
        `;

        return {
          success: true,
          data: result.rows[0],
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

  // Delete URL (soft delete)
  .delete("/api/urls/:id", async ({ params: { id } }) => {
    try {
      const now = new Date();

      const result = await sql`
        UPDATE urls 
        SET 
          "isDeleted" = true,
          "deletedAt" = ()NOW
        WHERE id = ${id}
        RETURNING id
      `;

      if (result.rows.length === 0) {
        return {
          success: false,
          error: "URL not found",
        };
      }

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

  // Handle 404 and errors
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

// For local development
if (process.env.NODE_ENV !== "production" && process.env.VERCEL !== "1") {
  app.listen(Number(process.env.PORT) || 3002);
  console.log(
    `🚀 Server running at http://localhost:${process.env.PORT || 3002}`
  );
}

// Export for Vercel (using Node.js adapter)
export default app.fetch;
