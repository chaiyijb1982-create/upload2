
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
              
              Sidebar:
              fixed
              w-64 = 256px
              
              页面滚动时 Sidebar 不动
          ================================================= */}

          <Sidebar />


          {/* =================================================
              Main

              给固定 Sidebar 留出 256px 空间

              ml-64 = margin-left: 16rem = 256px
          ================================================= */}

          <main
            className="
              ml-64
              min-h-screen
              overflow-x-hidden
            "
          >

            {children}

          </main>

        </div>

      </body>

    </html>

  );

}