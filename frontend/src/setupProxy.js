// The browser only talks to the frontend origin. Requests to /api are forwarded
// to the FastAPI backend on the server side, so the same code works in the
// sandbox preview and in production.
const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function setupProxy(app) {
  app.use(
    "/api",
    createProxyMiddleware({
      target: process.env.BACKEND_URL || "http://localhost:8001",
      changeOrigin: true,
      logLevel: "warn",
    })
  );
};
