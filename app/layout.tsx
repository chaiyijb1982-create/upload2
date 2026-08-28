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
    <html lang="zh-CN">
      <body>
        <div className="min-h-screen bg-gray-100">
          {/* =================================================
              Sidebar

              PC:
              fixed
              w-64 = 256px

              Mobile:
              Sidebar 使用 Drawer
              不占 Main 空间
          ================================================= */}

          <Sidebar />

          {/* =================================================
              Main

              PC:
              md:ml-64
              给 Sidebar 留出 256px

              Mobile:
              ml-0
              主页面占满整个屏幕

              overflow-x-hidden
              防止页面出现横向滚动
          ================================================= */}

          <main
            className="
              md:ml-64
              min-h-screen
              overflow-x-hidden
              w-auto
              max-w-full
            "
          >
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}