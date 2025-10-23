import { pool } from "../config/db.js";

export const health = async (_req, res) => {
  const [rows] = await pool.query("SELECT NOW() AS now");
  res.json({ ok: true, now: rows[0].now });
};
