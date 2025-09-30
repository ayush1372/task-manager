import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabase } from "../config/supabase.js";
import { jwtConfig } from "../config/jwt.js";

export const authService = {
  register: async ({ name, email, password, role }) => {
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (existingUser) {
      throw new Error("Email already registered");
    }

    const { data, error } = await supabase
      .from("users")
      .insert([{ name, email, password: hashedPassword, role: role || "USER" }])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  login: async ({ email, password }) => {
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user) {
      throw new Error("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error("Invalid credentials");
    }

    // Access token
    const accessToken = jwt.sign(
      { userId: user.id, role: user.role },
      jwtConfig.accessSecret,
      { expiresIn: jwtConfig.accessExpiry }
    );

    // Refresh token
    const refreshToken = jwt.sign(
      { userId: user.id, role: user.role },
      jwtConfig.refreshSecret,
      { expiresIn: jwtConfig.refreshExpiry }
    );

    // Save refresh token in DB
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const { data, err } = await supabase
      .from("refresh_tokens")
      .insert([{ token: refreshToken, user_id: user.id, expires_at:expiresAt }]); 

    if (err) {
      console.error("Error inserting refresh token:", err);
    } else {
      console.log("Refresh token inserted:", data);
    }

    return { accessToken, refreshToken, user };
  },

  refresh: async ({ refreshToken }) => {
    try {
      const payload = jwt.verify(refreshToken, jwtConfig.refreshSecret);

      const { data: storedToken, error } = await supabase
        .from("refresh_tokens")
        .select("*")
        .eq("token", refreshToken)
        .single();

      if (error || !storedToken) {
        throw new Error("Invalid refresh token");
      }

      if (new Date(storedToken.expiresAt) < new Date()) {
        throw new Error("Refresh token expired");
      }

      // Generate new access token
      const accessToken = jwt.sign(
        { userId: payload.userId, role: payload.role },
        jwtConfig.accessSecret,
        { expiresIn: jwtConfig.accessExpiry }
      );
      return { accessToken };
    } catch (error) {
      throw new Error("Invalid or expired refresh token");
    }
  },

  logout: async ({ refreshToken }) => {
    const { data: tokenInDb, error } = await supabase
      .from("refresh_tokens")
      .select("token")
      .eq("token", refreshToken)
      .single();

    if (error || !tokenInDb) {
      throw new Error("Refresh token not found");
    }

    await supabase.from("refresh_tokens").delete().eq("token", refreshToken);

    return { message: "Logged out successfully" };
  },
};
