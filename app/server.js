import express from "express";
import dotenv from "dotenv";
import routes from "./src/routes/index.js";
import { errorHandler } from "./src/middlewares/errorHandler.js";
import { swaggerSpec, swaggerUiMiddleware } from "./src/config/swagger.js";

dotenv.config();

const app = express();
app.use(express.json());

// Swagger UI
app.use("/docs", swaggerUiMiddleware.serve, swaggerUiMiddleware.setup(swaggerSpec));

// API routes
app.use("/", routes);

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`RIPY Token Server running on :${PORT} (NODE_ENV=${process.env.NODE_ENV})`);
});
