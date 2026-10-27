"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderMonthlyFeeBillEmail = exports.renderPasswordChangedEmail = exports.renderPasswordResetEmail = exports.renderOwnerCredentialsEmail = exports.renderWelcomeEmail = void 0;
const escapeHtml = (value) => (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const renderWelcomeEmail = (firstName) => {
    const safeName = escapeHtml(firstName || 'Member');
    const subject = 'Welcome to HostelGhar';
    const body = `Hi ${firstName},\n\nWelcome to HostelGhar. Your account is ready.\n\nRegards,\nHostelGhar Team`;
    const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;">
  <div style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:10px;padding:28px;border:1px solid #e2e8f0;">
    <h2 style="color:#2563eb;margin-top:0;">Welcome to HostelGhar</h2>
    <p>Hi <strong>${safeName}</strong>,</p>
    <p>Welcome to HostelGhar. Your account is now active and ready to use.</p>
    <p style="margin-top:24px;color:#64748b;font-size:13px;">Warm regards,<br>HostelGhar Team &bull; <a href="https://hostelghar.com" style="color:#2563eb;">hostelghar.com</a></p>
  </div>
</body>
</html>`;
    return { subject, body, html };
};
exports.renderWelcomeEmail = renderWelcomeEmail;
const renderOwnerCredentialsEmail = (firstName, email, temporaryPassword) => {
    const safeName = escapeHtml(firstName || 'Owner');
    const safeEmail = escapeHtml(email);
    const subject = 'Your HostelGhar owner account is ready';
    const body = `Hi ${firstName},\n\n` +
        'An owner dashboard account has been created for you.\n\n' +
        `Login email: ${email}\n` +
        `Temporary password: ${temporaryPassword}\n\n` +
        'Please log in and change this password immediately. Do not share these credentials.\n\n' +
        'Regards,\nHostelGhar Team';
    const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;">
  <div style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:10px;padding:28px;border:1px solid #e2e8f0;">
    <h2 style="color:#2563eb;margin-top:0;">HostelGhar Owner Account</h2>
    <p>Hi <strong>${safeName}</strong>,</p>
    <p>An owner dashboard account has been created for you:</p>
    <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:4px 0;"><strong>Login email:</strong> ${safeEmail}</p>
      <p style="margin:4px 0;"><strong>Temporary password:</strong> <code style="background:#e2e8f0;padding:2px 6px;border-radius:4px;">${escapeHtml(temporaryPassword)}</code></p>
    </div>
    <p style="color:#dc2626;font-size:13px;">⚠️ Please log in and change this password immediately. Never share these credentials.</p>
    <p style="margin-top:24px;color:#64748b;font-size:13px;">Regards,<br>HostelGhar Team</p>
  </div>
</body>
</html>`;
    return { subject, body, html };
};
exports.renderOwnerCredentialsEmail = renderOwnerCredentialsEmail;
const renderPasswordResetEmail = (firstName, resetToken, resetUrl) => {
    const safeName = escapeHtml(firstName || 'User');
    const targetUrl = resetUrl || `https://hostelghar.com/reset-password?token=${encodeURIComponent(resetToken)}`;
    const subject = 'Reset your HostelGhar password';
    const body = `Hi ${firstName},\n\n` +
        `Use this password reset token to reset your password:\n\n${resetToken}\n\n` +
        `Or click this link directly:\n${targetUrl}\n\n` +
        'This token expires in 15 minutes. If you did not request this, ignore this email.\n\n' +
        'Regards,\nHostelGhar Security';
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%);padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">HostelGhar</h1>
              <p style="margin:6px 0 0;color:#93c5fd;font-size:14px;">Password Reset Request</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 24px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#334155;">Hi <strong>${safeName}</strong>,</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:24px;color:#475569;">
                We received a request to reset the password for your HostelGhar account. Click the button below to set a new password:
              </p>
              <!-- CTA Button -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0;">
                <tr>
                  <td align="center">
                    <a href="${targetUrl}" target="_blank" style="display:inline-block;background-color:#2563eb;color:#ffffff;font-size:15px;font-weight:600;line-height:48px;text-align:center;text-decoration:none;padding:0 32px;border-radius:8px;box-shadow:0 2px 4px rgba(37,99,235,0.25);">Reset My Password</a>
                  </td>
                </tr>
              </table>
              <!-- Token Box -->
              <div style="background-color:#f1f5f9;border-radius:8px;padding:16px;margin:24px 0 20px;border:1px dashed #cbd5e1;text-align:center;">
                <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;font-weight:600;">Or enter this reset token manually:</p>
                <code style="display:inline-block;background:#ffffff;padding:8px 12px;border-radius:6px;border:1px solid #e2e8f0;font-size:13px;font-family:monospace;color:#0f172a;word-break:break-all;">${escapeHtml(resetToken)}</code>
              </div>
              <p style="margin:0 0 16px;font-size:13px;line-height:20px;color:#64748b;">
                ⏰ <strong>This link and token expire in 15 minutes.</strong>
              </p>
              <div style="border-top:1px solid #f1f5f9;padding-top:16px;margin-top:20px;">
                <p style="margin:0;font-size:13px;line-height:20px;color:#94a3b8;">
                  If you did not request a password reset, you can safely ignore this email. Your password will not change.
                </p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:18px;">
                HostelGhar &bull; Nepal's Premier Hostel Management Platform<br>
                <a href="https://hostelghar.com" style="color:#64748b;text-decoration:underline;">hostelghar.com</a> &bull; Support: <a href="mailto:info@hostelghar.com" style="color:#64748b;text-decoration:underline;">info@hostelghar.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    return { subject, body, html };
};
exports.renderPasswordResetEmail = renderPasswordResetEmail;
const renderPasswordChangedEmail = (firstName) => {
    const safeName = escapeHtml(firstName || 'User');
    const subject = 'Your HostelGhar password was changed';
    const body = `Hi ${firstName},\n\n` +
        'Your HostelGhar password was changed successfully. If this was not you, contact support immediately.\n\n' +
        'Regards,\nHostelGhar Security';
    const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;">
  <div style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:10px;padding:28px;border:1px solid #e2e8f0;">
    <h2 style="color:#059669;margin-top:0;">Password Changed Successfully</h2>
    <p>Hi <strong>${safeName}</strong>,</p>
    <p>Your HostelGhar password was changed successfully.</p>
    <p style="color:#dc2626;font-size:13px;">If you did not make this change, please contact our support team immediately at <a href="mailto:info@hostelghar.com">info@hostelghar.com</a>.</p>
    <p style="margin-top:24px;color:#64748b;font-size:13px;">Regards,<br>HostelGhar Security Team</p>
  </div>
</body>
</html>`;
    return { subject, body, html };
};
exports.renderPasswordChangedEmail = renderPasswordChangedEmail;
const npr = (value) => `NPR ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const renderMonthlyFeeBillEmail = (input) => {
    const subject = `Hostel Fee Bill — ${input.nepaliMonthLabel} | ${input.hostelName}`;
    const body = `Dear ${input.studentName},\n\n` +
        `Your monthly hostel fee bill for ${input.nepaliMonthLabel} (${input.nepaliDateLabel}) has been generated by ${input.hostelName}.\n\n` +
        `Hostel: ${input.hostelName}\n` +
        `Hostel Owner: ${input.ownerName}\n` +
        (input.roomNumber ? `Room: ${input.roomNumber}\n` : '') +
        `\nBase Monthly Fee: ${npr(input.baseFee)}\n` +
        `Previous Outstanding Due: ${npr(input.outstandingDue)}\n` +
        `Total Amount Payable: ${npr(input.totalPayable)}\n` +
        `Due Date (AD): ${input.dueDateAd}\n` +
        (input.dueDateBs ? `Due Date (BS): ${input.dueDateBs}\n` : '') +
        `\nPlease pay before the due date to avoid a late penalty. If you already paid, please ignore this bill.\n\n` +
        `Warm regards,\n${input.ownerName}\n${input.hostelName} Management\n` +
        (input.hostelPhone ? `Phone: ${input.hostelPhone}\n` : '') +
        (input.hostelEmail ? `Email: ${input.hostelEmail}\n` : '');
    const row = (label, value, strong = false) => `<tr><td style="padding:10px 14px;color:#475569;font-size:14px;">${escapeHtml(label)}</td>` +
        `<td style="padding:10px 14px;text-align:right;font-size:14px;color:#0f172a;${strong ? 'font-weight:800;' : 'font-weight:600;'}">${escapeHtml(value)}</td></tr>`;
    const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">` +
        `<div style="max-width:640px;margin:0 auto;padding:24px;">` +
        `<div style="background:linear-gradient(135deg,#0f766e,#0ea5e9);border-radius:16px 16px 0 0;padding:24px;color:#fff;">` +
        `<div style="font-size:12px;letter-spacing:2px;opacity:.85;">HOSTELGHAR • MONTHLY FEE BILL</div>` +
        `<h1 style="margin:8px 0 4px;font-size:24px;">${escapeHtml(input.hostelName)}</h1>` +
        `<div style="font-size:14px;opacity:.95;">${escapeHtml(input.nepaliMonthLabel)} • ${escapeHtml(input.nepaliDateLabel)}</div>` +
        `<div style="margin-top:10px;font-size:13px;">Hostel Owner: <strong>${escapeHtml(input.ownerName)}</strong></div>` +
        `</div>` +
        `<div style="background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:24px;">` +
        `<p style="margin:0 0 6px;color:#0f172a;font-size:16px;">Dear <strong>${escapeHtml(input.studentName)}</strong>,</p>` +
        `<p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">Your monthly hostel fee bill for <strong>${escapeHtml(input.nepaliMonthLabel)}</strong> has been generated. Please find the bill summary below.</p>` +
        `<table style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">` +
        row('Hostel', input.hostelName) +
        row('Owner', input.ownerName) +
        (input.roomNumber ? row('Room', input.roomNumber) : '') +
        (input.billNo ? row('Bill No', input.billNo) : '') +
        row('Billing Month (BS)', `${input.nepaliMonthLabel} (${input.nepaliDateLabel})`) +
        row('Base Monthly Fee', npr(input.baseFee)) +
        row('Previous Outstanding Due', npr(input.outstandingDue)) +
        row('Total Amount Payable', npr(input.totalPayable), true) +
        row('Due Date (AD)', input.dueDateAd) +
        (input.dueDateBs ? row('Due Date (BS)', input.dueDateBs) : '') +
        `</table>` +
        `<div style="margin:16px 0;padding:14px 16px;border-left:4px solid #f59e0b;background:#fffbeb;border-radius:8px;color:#92400e;font-size:13px;">Please pay before the due date to avoid a late penalty. If you already paid, please ignore this bill.</div>` +
        `<div style="color:#475569;font-size:13px;line-height:1.7;">Warm regards,<br><strong>${escapeHtml(input.ownerName)}</strong><br>${escapeHtml(input.hostelName)} Management` +
        (input.hostelPhone ? `<br>Phone: ${escapeHtml(input.hostelPhone)}` : '') +
        (input.hostelEmail ? `<br>Email: ${escapeHtml(input.hostelEmail)}` : '') +
        `</div>` +
        `</div>` +
        `<div style="text-align:center;color:#94a3b8;font-size:12px;margin-top:14px;">This is an automated HostelGhar billing email. Please do not reply directly.</div>` +
        `</div></body></html>`;
    return { subject, body, html };
};
exports.renderMonthlyFeeBillEmail = renderMonthlyFeeBillEmail;
