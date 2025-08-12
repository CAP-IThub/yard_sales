const nodemailer = require('nodemailer');
require('dotenv').config();

async function main() {
  let transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  let info = await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: "iewedairo@capplc.com", // your user email
    subject: "Test Email to User",
    text: "This is a test email to your user address.",
  });

  console.log("Message sent: %s", info.messageId);
}

main().catch(console.error);
