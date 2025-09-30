import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/authRoutes.js';
import workspaceRoutes from "./routes/workspaceRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import membershipRoutes from "./routes/membershipRoutes.js";
import { authorize, authenticate } from './middlewares/authMiddleware.js';
import invitationRoutes from "./routes/invitationRoutes.js";

dotenv.config();
import { supabase } from './config/supabase.js';

const app = express();

// Middlewares
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

//test route 
app.get("/",(req,res)=>{
    res.json({message:"Task Manager API running with Supabase 🚀"});
})

//example: get all users
app.get("/users", async (req, res) => {
  try {
    const { data: users, error } = await supabase.from("users").select("*");
    if (error) throw error;
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.use("/auth", authRoutes);

app.use("/api", workspaceRoutes);  // workspace + nested project endpoints
app.use("/api", projectRoutes);    // update/delete project
app.use("/api", membershipRoutes); // membership endpoints
app.use("/api", invitationRoutes);

// health
app.get("/", (req, res) => res.json({ message: "Task Manager API" }));

app.get("/users/me", authenticate ,async(req,res)=>{
     const { data: user, error } = await supabase
       .from("users")
       .select("*")
       .eq("id", req.user.userId)
       .single();
     if (error) return res.status(404).json({ error: "User not found" });
     res.status(200).json(user);
});

// Role-based route
app.get("/admin", authenticate, authorize(["ADMIN"]), (req, res) => {
  res.status(200).json({ message: "Welcome Admin 🚀" });
});

const PORT = process.env.PORT ;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));