import nodemailer from 'nodemailer';
import { MAIL_FROM } from '@/lib/mail/transporter';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: Number(process.env.SMTP_PORT) || 587,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

export function assertOtpMailConfiguration(): void {
    // Keep the development Ethereal fallback for the legacy/local flow, but
    // never let a production registration silently use an implicit transport.
    if (process.env.NODE_ENV !== 'production') return;

    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS;
    const configuredPort = process.env.SMTP_PORT?.trim();
    const port = configuredPort ? Number(configuredPort) : 587;

    if (!host || !user || !pass || !Number.isInteger(port) || port <= 0 || port > 65535) {
        throw new Error('SMTP configuration is not available for registration mail.');
    }
}

function logMailFailure(operation: string, error: unknown): void {
    // Do not serialize Nodemailer errors: they can contain recipient/message
    // details. Registration logs only a stable diagnostic category.
    console.error(`[auth.mail] ${operation} failed`, {
        error: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
    });
}

export type OtpMailPurpose = "personal" | "school";

const OTP_MAIL_COPY: Record<
    OtpMailPurpose,
    { readonly subject: string; readonly heading: string; readonly lead: string }
> = {
    personal: {
        subject: "Verify your LinkBridge email",
        heading: "Your LinkBridge verification code",
        lead: "Your LinkBridge verification code is",
    },
    school: {
        subject: "Verify your school email on LinkBridge",
        heading: "Verify your school email",
        lead: "Your LinkBridge school email verification code is",
    },
};

export async function sendOTP(
    email: string,
    otpCode: string,
    options?: { readonly purpose?: OtpMailPurpose }
) {
    assertOtpMailConfiguration();

    const copy = OTP_MAIL_COPY[options?.purpose ?? "personal"];

    try {
        const info = await transporter.sendMail({
            from: MAIL_FROM,
            to: email,
            subject: copy.subject,
            text: `${copy.lead}: ${otpCode}. It will expire in 10 minutes.`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>${copy.heading}</h2>
                    <p>Your one-time verification code is:</p>
                    <h1 style="font-size: 32px; letter-spacing: 5px; color: #1e40af;">${otpCode}</h1>
                    <p>This code will expire in 10 minutes. Please do not share it with anyone.</p>
                </div>
            `
        });

        return info;
    } catch (error) {
        logMailFailure('OTP email delivery', error);
        throw new Error("Failed to send verification email.");
    }
}

export async function sendSchoolInvite(email: string, schoolName: string, inviteUrl: string) {
    try {
        const info = await transporter.sendMail({
            from: MAIL_FROM,
            to: email,
            subject: `Invitation to Manage ${schoolName} on LinkBridge`,
            text: `You have been invited to manage ${schoolName} on LinkBridge. Click the following link to register: ${inviteUrl}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Welcome to LinkBridge!</h2>
                    <p>You have been invited to manage <strong>${schoolName}</strong>.</p>
                    <p>Please click the button below to complete your registration and set up your school admin account:</p>
                    <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background-color: #1e40af; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; margin-top: 16px;">Register Now</a>
                    <p style="margin-top: 24px; font-size: 14px; color: #666;">This link will expire in 72 hours. If you did not expect this invitation, you can ignore this email.</p>
                </div>
            `
        });

        return info;
    } catch (error) {
        logMailFailure('school invite email delivery', error);
        throw new Error("Failed to send invite email.");
    }
}

export async function sendPasswordResetOTP(email: string, otpCode: string) {
    try {
        const info = await transporter.sendMail({
            from: MAIL_FROM,
            to: email,
            subject: "LinkBridge Password Reset",
            text: `Your password reset code is: ${otpCode}. It will expire in 2 minutes.`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>LinkBridge Password Reset</h2>
                    <p>We received a request to reset your password. Your reset code is:</p>
                    <h1 style="font-size: 32px; letter-spacing: 5px; color: #1e40af;">${otpCode}</h1>
                    <p>This code will expire in 2 minutes. If you did not request this, please ignore this email.</p>
                </div>
            `
        });

        return info;
    } catch (error) {
        logMailFailure('password reset email delivery', error);
        throw new Error("Failed to send reset email.");
    }
}
