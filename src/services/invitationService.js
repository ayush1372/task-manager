import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import bcrypt from "bcryptjs";
import { supabase } from "../config/supabase.js";

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

export const invitationService = {
  createInvitation: async ({
    projectId,
    inviterId,
    email,
    role = "MEMBER",
  }) => {
    // check duplicate pending invitation
    const { data: existing } = await supabase
      .from("invitations")
      .select("*")
      .eq("email", email)
      .eq("projectId", Number(projectId))
      .eq("accepted", false)
      .gt("expiresAt", new Date())
      .single();
    if (existing) throw new Error("There is already a pending invitation for this email");

    // create token (JWT) with projectId, email
    const token = jwt.sign(
      { projectId: Number(projectId), email },
      INVITE_SECRET,
      { expiresIn: `${INVITE_HOURS}h` }
    );

    const expiresAt = new Date(Date.now() + INVITE_HOURS * 60 * 60 * 1000);

    const { data: invite, error } = await supabase
      .from("invitations")
      .insert([{
        email,
        token,
        projectId: Number(projectId),
        inviterId: Number(inviterId),
        role,
        expiresAt,
        accepted: false,
      }])
      .select()
      .single();
    if (error) throw new Error(error.message);

    // send email (fire-and-forget)
    const inviteLink = `${APP_BASE}/auth/invite/accept?token=${encodeURIComponent(token)}`;
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: `You're invited to join project #${projectId}`,
      text: `You have been invited. Accept: ${inviteLink}`,
      html: `<p>You have been invited to a project.</p><p><a href="${inviteLink}">Click to accept invitation</a></p><p>This link expires in ${INVITE_HOURS} hours.</p>`,
    };

    transporter.sendMail(mailOptions).catch((err) => {
      console.error("Invite email error:", err);
    });

    return invite;
  },

  verifyInviteToken: async ({ token }) => {
    let payload;
    try {
      payload = jwt.verify(token, INVITE_SECRET);
    } catch (err) {
      throw new Error("Invalid or expired invitation token");
    }

    const { data: invite, error } = await supabase
      .from("invitations")
      .select("*")
      .eq("token", token)
      .single();
    if (error || !invite) throw new Error("Invitation not found");
    if (invite.accepted) throw new Error("Invitation already accepted");
    if (new Date(invite.expiresAt) < new Date()) throw new Error("Invitation expired");

    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("email", invite.email)
      .single();

    return { invite, user };
  },

  acceptInviteForExistingUser: async ({ token, userId }) => {
    const { data: invite, error } = await supabase
      .from("invitations")
      .select("*")
      .eq("token", token)
      .single();
    if (error || !invite) throw new Error("Invitation not found");
    if (invite.accepted) throw new Error("Invitation already accepted");
    if (new Date(invite.expiresAt) < new Date()) throw new Error("Invitation expired");

    // Check membership
    const { data: existingMembership } = await supabase
      .from("memberships")
      .select("*")
      .eq("projectId", invite.projectId)
      .eq("userId", Number(userId))
      .single();

    if (existingMembership) {
      await supabase
        .from("invitations")
        .update({ accepted: true })
        .eq("id", invite.id);
      return {
        message: "User already a member, invitation marked accepted",
        membership: existingMembership,
      };
    }

    await supabase
      .from("memberships")
      .insert([{
        projectId: invite.projectId,
        userId: Number(userId),
        role: invite.role,
      }]);

    await supabase
      .from("invitations")
      .update({ accepted: true })
      .eq("id", invite.id);

    return { message: "Invitation accepted, membership created" };
  },

  registerAndAcceptInvite: async ({ token, name, password }) => {
    let payload;
    try {
      payload = jwt.verify(token, INVITE_SECRET);
    } catch (error) {
      throw new Error("Invalid or expired invitation token");
    }

    const { data: invite, error: invError } = await supabase
      .from("invitations")
      .select("*")
      .eq("token", token)
      .single();
    if (invError || !invite) throw new Error("Invitation not found");
    if (invite.accepted) throw new Error("Invitation already accepted");
    if (new Date(invite.expiresAt) < new Date()) throw new Error("Invitation expired");

    // ensure email not already used
    const { data: existing } = await supabase
      .from("users")
      .select("*")
      .eq("email", invite.email)
      .single();
    if (existing) throw new Error("Email already registered");

    // create user
    const hashed = await bcrypt.hash(password, 10);
    const { data: newUser, error: userError } = await supabase
      .from("users")
      .insert([{
        name,
        email: invite.email,
        password: hashed,
        role: "USER",
      }])
      .select()
      .single();
    if (userError) throw new Error(userError.message);

    // create membership
    await supabase
      .from("memberships")
      .insert([{
        projectId: invite.projectId,
        userId: newUser.id,
        role: invite.role || "MEMBER",
      }]);

    // mark invite accepted
    await supabase
      .from("invitations")
      .update({ accepted: true })
      .eq("id", invite.id);

    return newUser;
  },

  revokeInvitation: async ({ invitationId }) => {
    const { data: inv, error } = await supabase
      .from("invitations")
      .select("*")
      .eq("id", Number(invitationId))
      .single();
    if (error || !inv) throw new Error("Invitation not found");

    await supabase
      .from("invitations")
      .delete()
      .eq("id", Number(invitationId));
    return;
  },
};