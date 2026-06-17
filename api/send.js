// Vercel Serverless Function — sends a designed confirmation email to the
// visitor (via Resend) plus an internal notification. Key stays server-side.
//
// Env vars (Vercel → Settings → Environment Variables):
//   RESEND_API_KEY   (required) your Resend API key
//   TEST_EMAIL       (optional) while no domain is verified, route ALL mail here
//                    (must be your Resend account address, e.g. ksqsebastian@googlemail.com)
//   RESEND_FROM      (optional) e.g. "Tischlerei Mehlig <hallo@tischlerei-mehlig.de>" — needs a verified domain
//   NOTIFY_CONTACT   (optional) inbox for enquiries   (default info@tischlerei-mehlig.de)
//   NOTIFY_RECRUIT   (optional) inbox for applications (default bewerbung@tischlerei-mehlig.de)
//   MAIL_IMAGE       (optional) hero image URL for the email

const FROM = process.env.RESEND_FROM || 'Tischlerei Mehlig <onboarding@resend.dev>';
const NOTIFY_CONTACT = process.env.NOTIFY_CONTACT || 'info@tischlerei-mehlig.de';
const NOTIFY_RECRUIT = process.env.NOTIFY_RECRUIT || 'bewerbung@tischlerei-mehlig.de';
const POC_TEST_TO = 'ksqsebastian@googlemail.com'; // POC: deliver here until a Resend domain is verified (then set RESEND_FROM)
const IMG = process.env.MAIL_IMAGE || 'https://korn-fenster.de/media/pages/home/fd4dc234e0-1758639882/korn_lignum_usa.jpg';

const esc = (s) => String(s == null ? '' : s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

// Copy per funnel variant.
const COPY = {
  contact: {
    subject: (name) => `Danke, ${name} — wir melden uns`,
    notifyLabel: 'Neue Anfrage',
    intro: `vielen herzlichen Dank — wir freuen uns riesig, dass du dich für die Tischlerei Mehlig entschieden hast. Dein Vertrauen bedeutet uns viel.`,
    middle: `Wir haben deine Nachricht erhalten und melden uns <b style="color:#141414;">schnellstmöglich persönlich &amp; telefonisch</b> bei dir, um alles Weitere in Ruhe zu besprechen.`,
    showPortfolioCta: true
  },
  recruit: {
    subject: (name) => `Danke für deine Bewerbung, ${name}`,
    notifyLabel: 'Neue Bewerbung',
    intro: `vielen herzlichen Dank für deine Bewerbung — wir freuen uns riesig, dass du dir die Tischlerei Mehlig als Ort für deinen nächsten Schritt vorstellen kannst. Dein Interesse ehrt uns.`,
    middle: `Wir sehen uns deine Angaben jetzt in aller Ruhe an und melden uns <b style="color:#141414;">schnellstmöglich ganz persönlich</b> bei dir, um dich kennenzulernen.`,
    extra: `Bei uns zählt der Mensch hinter der Bewerbung — und wir nehmen uns die Zeit, die du verdienst.`,
    closing: `Bis dahin: schön, dass du den Weg zu uns gefunden hast.`,
    showPortfolioCta: false
  },
  portfolio: {
    subject: (name) => `Dein Portfolio ist unterwegs, ${name}`,
    notifyLabel: 'Portfolio-Anfrage',
    intro: `vielen herzlichen Dank für deine Anfrage — wir freuen uns riesig, dir unser physisches Portfolio zusenden zu dürfen.`,
    middle: `Wir verpacken es mit Sorgfalt und bringen es <b style="color:#141414;">schnellstmöglich auf den Weg zu dir</b>. Lass dich von unseren Projekten in Ruhe inspirieren — gedruckt, zum Anfassen.`,
    showPortfolioCta: false
  }
};

function portfolioCta(baseUrl) {
  if (!baseUrl) return '';
  return `<tr><td style="padding:8px 48px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#A02615;">
        <a href="${baseUrl}/portfolio.html" style="display:inline-block;padding:14px 26px;font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#ffffff;text-decoration:none;">Physisches Portfolio anfragen →</a>
      </td></tr></table>
    </td></tr>`;
}

function customerEmail({ name, variant, baseUrl }) {
  const c = COPY[variant] || COPY.contact;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f1efea;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1efea;padding:32px 0;font-family:Georgia,'Times New Roman',serif;">
<tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:92%;background:#ffffff;border:1px solid #e7e3dd;">
    <tr><td style="padding:0;"><img src="${IMG}" width="600" alt="" style="display:block;width:100%;height:auto;border:0;"></td></tr>
    <tr><td style="padding:40px 48px 0;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:4px;color:#A02615;text-transform:uppercase;">Tischlerei Mehlig</div>
      <div style="font-size:32px;line-height:1.15;color:#141414;margin-top:22px;">Hallo ${esc(name) || 'und herzlich willkommen'},</div>
    </td></tr>
    <tr><td style="padding:20px 48px 0;font-size:17px;line-height:1.7;color:#3a3633;">
      <p style="margin:0 0 16px;">${c.intro}</p>
      <p style="margin:0 0 16px;">${c.middle}</p>
      ${c.extra ? `<p style="margin:0 0 16px;">${c.extra}</p>` : ''}
      <p style="margin:0 0 4px;">${c.closing || 'Bis dahin: schön, dass du da bist.'}</p>
    </td></tr>
    ${c.showPortfolioCta ? portfolioCta(baseUrl) : ''}
    <tr><td style="padding:26px 48px 44px;">
      <div style="font-size:18px;color:#141414;">Herzliche Grüße</div>
      <div style="font-size:18px;color:#A02615;">dein Team der Tischlerei Mehlig</div>
    </td></tr>
    <tr><td style="padding:26px 48px;background:#141414;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.9;letter-spacing:.5px;color:#b9b3ac;">
      <div style="color:#ffffff;font-size:13px;letter-spacing:5px;margin-bottom:6px;">M E H L I G</div>
      Von-Linné-Str. 1 · 22880 Wedel / Hamburg · Germany<br>
      T +49 (0) 41 03 91 60 – 0 · <a href="mailto:info@tischlerei-mehlig.de" style="color:#d98b7f;text-decoration:none;">info@tischlerei-mehlig.de</a>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

function internalEmail({ rows, email, notifyLabel, routedNote }) {
  const list = rows.map(r => `<tr><td style="padding:6px 0;border-bottom:1px solid #eee;font-size:14px;color:#222;">${esc(r)}</td></tr>`).join('');
  return `<!doctype html><html><body style="margin:0;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#222;">
  <div style="max-width:560px;margin:24px auto;padding:0 16px;">
    <div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#A02615;">${esc(notifyLabel)} · tischlerei-mehlig.de</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">${list}</table>
    <p style="margin-top:18px;font-size:14px;">Antworten an: <a href="mailto:${esc(email)}">${esc(email)}</a></p>
    ${routedNote ? `<p style="margin-top:10px;font-size:12px;color:#999;">${esc(routedNote)}</p>` : ''}
  </div></body></html>`;
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = req.body;
  if (raw === undefined || raw === null) {
    raw = await new Promise((resolve) => {
      let d = ''; req.on('data', c => (d += c)); req.on('end', () => resolve(d)); req.on('error', () => resolve(''));
    });
  }
  if (typeof raw === 'string') { try { return JSON.parse(raw || '{}'); } catch (_) { return {}; } }
  return raw || {};
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  const key = process.env.RESEND_API_KEY;
  if (!key) { res.status(500).json({ error: 'RESEND_API_KEY not configured' }); return; }

  const body = await readBody(req);
  const variant = ['contact', 'recruit', 'portfolio'].includes(body.variant) ? body.variant : 'contact';
  const copy = COPY[variant];
  const data = body.data || {};
  const labels = body.labels || {};
  const name = String(data.name || '').slice(0, 80);
  const email = String(data.email || '').trim();
  const emailValid = /.+@.+\..+/.test(email);

  // Base URL for links inside the email (e.g. the portfolio CTA button).
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const baseUrl = host ? `${proto}://${host}` : '';

  const notifyReal = variant === 'recruit' ? NOTIFY_RECRUIT : NOTIFY_CONTACT;
  // Resend only delivers to your own address until a domain is verified.
  // Until RESEND_FROM (a verified-domain sender) is set, route ALL mail to the
  // test inbox so the flow works end-to-end; afterwards it goes to real recipients.
  const routeTo = process.env.TEST_EMAIL || (process.env.RESEND_FROM ? '' : POC_TEST_TO);
  // A valid visitor e-mail is only required when actually sending to the visitor.
  if (!routeTo && !emailValid) { res.status(400).json({ error: 'invalid email' }); return; }
  const customerTo = routeTo || email;
  const notifyTo = routeTo || notifyReal;
  const routedNote = routeTo ? `Testmodus: alle Mails an ${routeTo} (Kunde: ${email || '—'}).` : '';
  const rows = Object.keys(labels).map(k => (data[k] ? `${labels[k]}: ${data[k]}` : null)).filter(Boolean);

  const send = async (payload) => {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const t = await r.text();
      return { ok: r.ok, status: r.status, body: t };
    } catch (e) { return { ok: false, status: 0, body: String(e) }; }
  };

  const customer = await send({
    from: FROM, to: customerTo, reply_to: notifyReal,
    subject: copy.subject(name || 'und herzlich willkommen'),
    html: customerEmail({ name, variant, baseUrl })
  });
  const internalPayload = {
    from: FROM, to: notifyTo,
    subject: `${copy.notifyLabel} – ${name || email || 'Tischlerei Mehlig'}`,
    html: internalEmail({ rows, email, notifyLabel: copy.notifyLabel, routedNote })
  };
  if (emailValid) internalPayload.reply_to = email;
  const internal = await send(internalPayload);

  if (customer.ok || internal.ok) {
    res.status(200).json({ ok: true, customer: customer.ok, internal: internal.ok });
  } else {
    console.error('resend failed', { customer, internal });
    res.status(502).json({ error: 'send_failed', customer, internal });
  }
};
