import jwt from "jsonwebtoken";

import nodemailer from "nodemailer";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const INVITE_SECRET = process.env.INVITE_TOKEN_SECRET;
const INVITE_HOURS = Number(process.env.INVITE_TOKEN_EXPIRY_HOURS || 72);
const APP_BASE = process.env.APP_BASE_URL || "http://localhost:5000";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Generate token payload and save invitation record & email link
 */

export const invitationService = {
  createInvitation: async ({
    projectId,
    inviterId,
    email,
    role = "MEMBER",
  }) => {
    // check duplicate pending invitation
    const existing = await prisma.invitation.findFirst({
      where: {
        email,
        projectId: Number(projectId),
        accepted: false,
        expiresAt: { gt: new Date() },
      },
    });
    if (existing)
      throw new Error("There is already a pending invitation for this email");

    // create token (JWT) with projectId, email
    const token = jwt.sign(
      { projectId: Number(projectId), email },
      INVITE_SECRET,
      {
        expiresIn: `${INVITE_HOURS}h`,
      }
    );

    const expiresAt = new Date(Date.now() + INVITE_HOURS * 60 * 60 * 1000);

    const invite = await prisma.invitation.create({
      data: {
        email,
        token,
        projectId: Number(projectId),
        inviterId: Number(inviterId),
        role,
        expiresAt,
      },
    });

    // send email (fire-and-forget)
    const inviteLink = `${APP_BASE}/auth/invite/accept?token=${encodeURIComponent(
      token
    )}`;
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: `You're invited to join project #${projectId}`,
      text: `You have been invited. Accept: ${inviteLink}`,
      html: `<p>You have been invited to a project.</p><p><a href="${inviteLink}">Click to accept invitation</a></p><p>This link expires in ${INVITE_HOURS} hours.</p>`,
    };

    transporter.sendMail(mailOptions).catch((err) => {
      // log but do not fail the API (optionally delete invitation if sending fails)
      console.error("Invite email error:", err);
    });

    return invite;
  },

  /**
   * Accept an invitation using token. Two flows:
   * - If user exists (by email), create membership immediately and mark invitation accepted.
   * - If user does not exist, return a response indicating the invite is valid and the front-end should call registration endpoint with token.
   *
   * When a new user registers with invite token, client should call register-with-invite endpoint below.
   */
  verifyInviteToken: async ({ token }) => {
    let payload;
    try {
      payload = jwt.verify(token, INVITE_SECRET);
    } catch (err) {
      throw new Error("Invalid or expired invitation token");
    }

    const invite = await prisma.invitation.findUnique({ where: { token } });
    if (!invite) throw new Error("Invitation not found");
    if (invite.accepted) throw new Error("Invitation already accepted");
    if (invite.expiresAt < new Date()) throw new Error("Invitation expired");

    const user = await prisma.user.findUnique({
      where: { email: invite.email },
    });

    return { invite, user }; // controller decides next step
  },

  /**
   * Accept invitation when user already exists -> creates membership and marks accepted
   */

  acceptInviteForExistingUser: async ({ token, userId }) => {
    const invite = await prisma.invitation.findUnique({ where: { token } });
    if (!invite) throw new Error("Invitation not found");
    if (invite.accepted) throw new Error("Invitation already accepted");
    if (invite.expiresAt < new Date()) throw new Error("Invitation expired");

    //create membership
    const existingMembership = await prisma.membership.findFirst({
      where: { projectId: invite.projectId, userId: Number(userId) },
    });

    if (existingMembership) {
      //mark invite accepted and return
      await prisma.invitation.update({
        where: { id: invite.id },
        data: { accepted: true },
      });
      return {
        message: "User already a member, invitation marked accepted",
        membership: existingMembership,
      };
    }

    await prisma.membership.create({
      data: {
        projectId: invite.projectId,
        userId: Number(userId),
        role: invite.role,
      },
    });

    await prisma.invitation.update({
      where: { id: invite.id },
      data: { accepted: true },
    });

    return { message: "Invitation accepted, membership created" };
  },

  /**
   * Register a new user and accept the invitation in an atomic transaction:
   * - create user
   * - create membership
   * - mark invitation accepted
   */

  registerAndAcceptInvite: async ({ token, name, password }) => {
    //verify token
    let payload;
    try {
      payload = jwt.verify(token, INVITE_SECRET);
    } catch (error) {
      throw new Error("Invalid or expired invitation token");
    }

    const invite = await prisma.invitation.findUnique({ where: { token } });
    if (!invite) throw new Error("Invitation not found");
    if (invite.accepted) throw new Error("Invitation already accepted");
    if (invite.expiresAt < new Date()) throw new Error("Invitation expired");

    // ensure email not already used (race)
    const existing = await prisma.user.findUnique({
      where: { email: invite.email },
    });
    if (existing) throw new Error("Email already registered");

    // create user + membership + mark invite accepted in transaction
    const hashed = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (prismaTx) => {
      const newUser = await prismaTx.user.create({
        data: {
          name,
          email: invite.email,
          password: hashed,
          role: "USER",
        },
      });

      await prismaTx.membership.create({
        data: {
          projectId: invite.projectId,
          userId: newUser.id,
          role: invite.role || "MEMBER",
        },
      });

      await prismaTx.invitation.update({
        where: { id: invite.id },
        data: { accepted: true },
      });
      return newUser;
    });

    return result;
  },

  revokeInvitation: async ({ invitationId, requesterId }) => {
    // you should check ownership in controller (only project admin or workspace creator)

    const inv = await prisma.invitation.findUnique({
      where: { id: Number(invitationId) },
    });
    if (!inv) throw new Error("Invitation not found");

    await prisma.invitation.delete({ where: { id: Number(invitationId) } });
    return;
  },
};
