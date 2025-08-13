import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { isAdmin } from '@/lib/rbac';
import prisma from '@/lib/db';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

function formatNaira(v){
  return '₦' + Number(v||0).toLocaleString('en-NG', { minimumFractionDigits: 2 });
}

function buildTransport(){
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);
  if(!session || !isAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const cycleId = params.id;
  const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
  if(!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  if(!['CLOSED','ARCHIVED'].includes(cycle.status)) return NextResponse.json({ error: 'Cycle must be CLOSED or ARCHIVED' }, { status: 400 });

  const bids = await prisma.bid.findMany({ where: { cycleId }, include: { user: true, item: true } });
  if(bids.length === 0) return NextResponse.json({ message: 'No bids to notify', sent: 0 });

  const perUser = new Map();
  for (const b of bids) {
    if(!b.user?.email) continue;
    if(!perUser.has(b.userId)) perUser.set(b.userId, { email: b.user.email, name: b.user.name, lines: [], totalValue: 0, totalQty: 0 });
    const u = perUser.get(b.userId);
    const price = b.item?.price != null ? Number(b.item.price) : 0;
    u.lines.push({ item: b.item.name, qty: b.qty, price, lineTotal: price * b.qty });
    u.totalValue += price * b.qty;
    u.totalQty += b.qty;
  }

  const accountName = process.env.PAYMENT_ACCOUNT_NAME || 'Company Account';
  const accountNumber = process.env.PAYMENT_ACCOUNT_NUMBER || '0000000000';
  const bankName = process.env.PAYMENT_BANK_NAME || 'Bank';
  const payInstructions = process.env.PAYMENT_INSTRUCTIONS || '';
  const supportEmail = process.env.SUPPORT_EMAIL || process.env.EMAIL_FROM;
  const appName = process.env.APP_NAME || 'Yard Sales';
  const deadlineDays = Number(process.env.PAYMENT_DEADLINE_DAYS || 5);
  const baseDate = cycle.closeAt ? new Date(cycle.closeAt) : new Date();
  const deadlineDate = new Date(baseDate.getTime() + deadlineDays*24*60*60*1000);
  const deadlineStr = deadlineDate.toLocaleDateString('en-NG', { year:'numeric', month:'short', day:'numeric' });

  const transport = buildTransport();

  let sent = 0, skipped = 0, errors = 0;
  for (const u of perUser.values()) {
    if(!u.email) { skipped++; continue; }
    const rowsHtml = u.lines
      .map(l => `<tr><td style="padding:4px 8px;border:1px solid #e2e8f0;">${l.item}</td><td style="padding:4px 8px;border:1px solid #e2e8f0;text-align:right;">${l.qty}</td><td style="padding:4px 8px;border:1px solid #e2e8f0;text-align:right;">${formatNaira(l.price)}</td><td style="padding:4px 8px;border:1px solid #e2e8f0;text-align:right;">${formatNaira(l.lineTotal)}</td></tr>`)
      .join('');
    // Outer wrapper helps constrain width in many email clients while staying responsive.
    const tableHtml = `<table role="presentation" style="width:100%;margin-top:12px;" cellspacing="0" cellpadding="0"><tr><td align="center">` +
      `<table style="border-collapse:collapse;font-size:12px;width:auto;max-width:560px;min-width:360px;margin:0 auto;table-layout:auto;">`+
        `<thead>`+
          `<tr style="background:#f1f5f9;">`+
            `<th style="padding:6px 8px;border:1px solid #e2e8f0;text-align:left;white-space:normal;">Item</th>`+
            `<th style="padding:6px 4px;border:1px solid #e2e8f0;text-align:right;">Qty</th>`+
            `<th style="padding:6px 4px;border:1px solid #e2e8f0;text-align:right;">Price</th>`+
            `<th style="padding:6px 4px;border:1px solid #e2e8f0;text-align:right;">Total</th>`+
          `</tr>`+
        `</thead>`+
        `<tbody>${rowsHtml}</tbody>`+
        `<tfoot>`+
          `<tr style="background:#eef2f7;font-weight:600;">`+
            `<td colspan="3" style="padding:6px 8px;border:1px solid #e2e8f0;text-align:right;">Grand&nbsp;Total</td>`+
            `<td style="padding:6px 4px;border:1px solid #e2e8f0;text-align:right;">${formatNaira(u.totalValue)}</td>`+
          `</tr>`+
        `</tfoot>`+
      `</table>`+
    `</td></tr></table>`;
    const textLines = u.lines.map(l => `- ${l.item} x${l.qty} @ ${l.price} = ${l.lineTotal}`).join('\n');
    const subject = `${appName}: Payment details for ${cycle.name}`;
    const intro = `Dear ${u.name || u.email},`;
    const html = `<!DOCTYPE html><html><body style="font-family:Arial,Segoe UI,sans-serif;font-size:14px;color:#0f172a;">`+
      `<p>${intro}</p>`+
      `<p>Congratulations! Here is the summary of items allocated to you in <strong>${cycle.name}</strong>.</p>`+
      tableHtml +
      `<p style="margin-top:16px;">Please make payment of <strong>${formatNaira(u.totalValue)}</strong> on or before <strong>${deadlineStr}</strong>.</p>`+
      `<p><strong>Account Details:</strong><br/>${accountName}<br/>${bankName} - ${accountNumber}</p>`+
      (payInstructions ? `<p>${payInstructions}</p>` : '') +
      `<p>If you have any questions reply to this email or contact <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>`+
      `<p>Thank you,<br/>${appName} Team</p>`+
      `<hr style="margin:28px 0;"/><p style="font-size:11px;color:#64748b;">This email was sent to ${u.email} because you participated in ${appName}. If you believe this is an error please contact support.</p>`+
      `</body></html>`;
    const text = `${intro}\n\nItems:\n${textLines}\n\nGrand Total: ${u.totalValue}\nPay by: ${deadlineStr}\nAccount: ${accountName} / ${bankName} / ${accountNumber}\n${payInstructions ? ('\n'+payInstructions+'\n') : ''}\nQuestions: ${supportEmail}\n\n${appName} Team`;
    try {
      await transport.sendMail({ to: u.email, from: process.env.EMAIL_FROM, subject, text, html, replyTo: supportEmail });
      sent++;
    } catch (e) {
      errors++;
    }
  }
  return NextResponse.json({ sent, skipped, errors, totalUsers: perUser.size, deadline: deadlineStr });
}
