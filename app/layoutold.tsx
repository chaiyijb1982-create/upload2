import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata = {
  title: "AI Wealth OS",
  description: "Personal Wealth Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>

        <div className="flex min-h-screen bg-gray-100">

          {/* Sidebar */}

          <Sidebar />

          {/* Main */}

          <main className="flex-1 overflow-auto">

            {children}

          </main>

        </div>

      </body>
    </html>
  );
}