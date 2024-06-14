import express from "express";

import globalErrorHandler from "./middlewares/globalErrorHandler";
import userRouter from "./users/userRouter";
import bookRouter from "./book/bookRouter";
import cors from "cors";
import { config } from "./config/config";

const app = express();

app.use(cors({
  origin: config.frontEndUrl,
}));

app.use(express.json());

// Routes
//Http methods: GET, POST, PUT, PATCH, DELETE
app.get("/", (req, res, next) => {
  res.json({ message: "Welcome to elib apis" });
});

app.use("/api/users", userRouter);
app.use("/api/books", bookRouter);

// Global error handler
app.use(globalErrorHandler);

export default app;
