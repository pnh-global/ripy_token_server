export function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const msg = err.message || "Internal Server Error";
  if (process.env.NODE_ENV !== "production") {
    console.error("[ERROR]", status, msg, err.stack);
  }
  res.status(status).json({ ok: false, error: msg });
}
