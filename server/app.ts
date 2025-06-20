require("dotenv").config();
import express, { NextFunction, Request, Response } from "express";
export const app = express();

import cors from "cors";
import cookieParser from "cookie-parser";
import { ErrorMiddleware } from "./middleware/error";
import reviewRouter from "./routes/reviewRoutes";
import thesisRouter from "./routes/thesisRoutes";
import authRouter from "./routes/authRoutes";
import adminRouter from "./routes/adminRoutes";
import path from 'path';


//Body parser
app.use(express.json({ limit: "50mb" }));

//cookie parse
app.use(cookieParser());

// cors => cros origin resource sharing
const allowedOrigins: string | string[] = process.env.ORIGIN
  ? JSON.parse(process.env.ORIGIN)
  : ""; 

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true, 
  })
);


//routes
app.use(
  "/api/v1",
    reviewRouter,
    thesisRouter,
    authRouter,
    adminRouter,
    authRouter,
);


//testing api
app.get("/test", (req: Request, res: Response, next: NextFunction) => {
  res.status(200).json({
    success: true,
    message: "API is working properly",
  });
});

//unknown routes
app.all("*", (req: Request, res: Response, next: NextFunction) => {
  const err = new Error(`Route ${req.originalUrl} not found`) as any;
  err.statusCode = 404;
  next(err);
});


const filePath = path.join(__dirname, 'uploads/theses');
app.use('/uploads/theses', express.static(filePath));


app.use(ErrorMiddleware);



