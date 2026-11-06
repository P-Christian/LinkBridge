// src/lib/mail/templates/otp.ts

export function otpTemplate(otp: string, expiryMinutes = 15) {
  return {
    subject: "Verify your LinkBridge Account",
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e4e4e7; padding: 24px; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #18181b; font-weight: 700; margin-top: 0;">Verify your LinkBridge Account</h2>
        <p style="color: #71717a; font-size: 14px; line-height: 1.5;">
          Thank you for registering on LinkBridge. Use the following One-Time Password (OTP) to complete your verification process:
        </p>
        <div style="background-color: #f4f4f5; padding: 16px; text-align: center; border-radius: 8px; font-size: 28px; font-weight: 800; letter-spacing: 4px; color: #18181b; margin: 20px 0;">
          ${otp}
        </div>
        <p style="color: #a1a1aa; font-size: 11px; margin-bottom: 0;">
          This code is valid for ${expiryMinutes} minutes. If you did not request this code, please ignore this email.
        </p>
      </div>
    `,
  };
}
