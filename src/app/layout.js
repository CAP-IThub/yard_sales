
import "./globals.css";
import Providers from '@/components/Providers';

export const metadata = {
  title: "Yard Sales",
  description: "Yard sales management application",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen font-sans noise-overlay text-[var(--foreground)]">
        <Providers>
          <div className="relative z-10">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
