import express from "express";
import { authController } from "../controllers/authController.js";
import { authenticate } from "../middlewares/authMiddleware.js";

const router = express.Router();

const validateRegister = (req, res, next) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ error: "Name, email, and password are required" });
  }
  next();
};

router.post("/register", validateRegister, authController.register);
router.post("/login", authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout",authenticate, authController.logout);

export default router;
