import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { jwtConfig } from "../config/jwt.js";
// import { ref } from "joi";

const prisma = new PrismaClient();

export const authService = {
  register: async ({ name, email, password,role }) => {
    const hashedPassword = await bcrypt.hash(password, 10);

    return prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || "USER",
      },
    });
  },

  login: async ({ email, password }) => {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new Error("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error("Invalid credentials");
    }

    //Access token
    const accessToken = jwt.sign(
      { userId: user.id, role: user.role },
      jwtConfig.accessSecret,
      { expiresIn: jwtConfig.accessExpiry }
    );

    //refresh token
    const refreshToken = jwt.sign(
      { userId: user.id, role: user.role },
      jwtConfig.refreshSecret,
      { expiresIn: jwtConfig.refreshExpiry }
    );

    //save refresh token in DB
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), //7 days
      },
    });

    return { accessToken, refreshToken, user };
  },

  refresh: async ({ refreshToken }) => {
    try {
      const payload = jwt.verify(refreshToken, jwtConfig.refreshSecret);
      const storedToken = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
      });

      if (!storedToken) {
        throw new Error("Invalid refresh token");
      }

      if (storedToken.expiresAt < new Date()) {
        throw new Error("Refresh token expired");
      }
        //generate new access token
      const accessToken  = jwt.sign(
        { userId: payload.userId, role: payload.role },
        jwtConfig.accessSecret,
        { expiresIn: jwtConfig.accessExpiry }
      );
      return { accessToken  };


    } catch (error) {
        throw new Error("Invalid or expired refresh token");
    }
  },

  logout: async ({ refreshToken }) => {
  const tokenInDb = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
  });

  if (!tokenInDb) {
    throw new Error("Refresh token not found");
  }

  await prisma.refreshToken.delete({
    where: { token: refreshToken },
  });

  return { message: "Logged out successfully" };
},

};
