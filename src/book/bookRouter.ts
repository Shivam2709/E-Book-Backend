import path from "node:path";
import express from "express";
import { createBook } from "./bookController";
import multer from "multer";

const bookRouter = express.Router();

// flie store in local --> then move to cloudnary
const upload = multer({
  dest: path.resolve(__dirname, "../../public/data/uploads"),
  limits: { fileSize: 3e7 }, // 3e7 means = 30mb = 30 * 1024 * 1024...
});

// Routes
bookRouter.post(
  "/",
  upload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ]),
  createBook
);

export default bookRouter;
