// server.ts - Minimal test version
import { Elysia } from "elysia";

const app = new Elysia()
  .get("/health", () => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      message: "Basic server is working",
    };
  })
  .get("/api/urls", () => {
    return {
      success: true,
      data: [],
      message: "API endpoint working - no database yet",
    };
  })
  .get("/test", () => {
    return "Hello from Elysia on Vercel!";
  })
  .onError(({ error }: { error: any }) => {
    console.error("Error:", error);
    return {
      success: false,
      error: error.message,
    };
  });

export default app;
