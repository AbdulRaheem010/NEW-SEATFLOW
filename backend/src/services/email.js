const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

function getConfig() {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || 'SeatFlow';
  if (!apiKey || !senderEmail) throw new Error('Brevo email configuration is missing.');
  return { apiKey, senderEmail, senderName };
}

async function sendPasswordResetEmail({ email, firstName, resetUrl }) {
  const { apiKey, senderEmail, senderName } = getConfig();
  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: { accept: 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email, name: firstName || email }],
      subject: 'Reset your SeatFlow password',
      textContent: [
        'We received a request to reset your SeatFlow password.',
        '',
        'Use this link to choose a new password:',
        resetUrl,
        '',
        'This link expires in 1 hour and can only be used once.',
        'If you did not request a password reset, you can safely ignore this email.',
      ].join('\n'),
      htmlContent: `<!doctype html><html lang="en"><body style="margin:0;background:#f5f7f8;font-family:Arial,sans-serif;color:#172126"><div style="max-width:560px;margin:40px auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:32px"><div style="font-size:22px;font-weight:700;margin-bottom:24px">SeatFlow</div><h1 style="font-size:24px;margin:0 0 12px">Reset your password</h1><p>Hi ${escapeHtml(firstName || 'there')},</p><p>We received a request to reset your SeatFlow password. Click the button below to choose a new password.</p><p style="margin:28px 0"><a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:13px 20px;border-radius:8px;font-weight:700">Reset password</a></p><p style="font-size:14px;color:#5f6b72">This link expires in 1 hour and can only be used once. If you did not request a password reset, you can safely ignore this email.</p></div></body></html>`,
    }),
  });
  if (!response.ok) {
    let detail = '';
    try { const body = await response.json(); detail = body.message || body.code || ''; } catch {}
    throw new Error(`Brevo rejected the email request (HTTP ${response.status})${detail ? `: ${detail}` : '.'}`);
  }
  return response.json();
}

function escapeHtml(value) {
  return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

module.exports = { sendPasswordResetEmail };
