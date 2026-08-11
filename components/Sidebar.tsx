"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const menus = [
  {
    id: 1,
    name: "资产总览",
    href: "/",
    icon: "🏠",
  },

  {
    id: 2,
    name: "资产管理",
    href: "/asset-management",
    icon: "📊",
  },

  {
    id: 3,
    name: "投资Perf",
    href: "/performance",
    icon: "📈",
  },

  {
    id: 4,
    name: "固收资产",
    href: "/fixed-income",
    icon: "🏦",
  },

  {
    id: 5,
    name: "贷款",
    href: "/loan",
    icon: "💰",
  },

  {
    id: 6,
    name: "保险",
    href: "/insurance",
    icon: "🛡️",
  },

  {
    id: 7,
    name: "财务自由规划",
    href: "/financial-freedom",
    icon: "💎",
  },

  {
    id: 8,
    name: "天天向上当前",
    href: "/tiantian-up",
    icon: "🚀",
  },

  {
    id: 9,
    name: "天天向上年度详细",
    href: "/tiantian-up-detail",
    icon: "🚀",
  },

  {
    id: 10,
    name: "退休规划",
    href: "/retirement",
    icon: "🎯",
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="
        fixed
        left-0
        top-0
        z-50
        w-64
        h-screen
        bg-white
        border-r
        border-gray-200
        p-6
        flex
        flex-col
      "
    >
      {/* Logo */}

      <div className="mb-10">
        <h1
          className="
            text-2xl
            font-bold
          "
        >
          AI Wealth OS
        </h1>

        <p
          className="
            text-gray-500
            text-sm
            mt-2
          "
        >
          Personal Wealth System
        </p>
      </div>

      {/* Menu */}

      <nav className="space-y-3">
        {menus.map((menu) => (
          <Link
            key={menu.id}
            href={menu.href}
            className={`
              flex
              items-center
              gap-4
              px-4
              py-3
              rounded-xl
              transition

              ${
                pathname === menu.href
                  ? "bg-blue-600 text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }
            `}
          >
            <span
              className="
                text-xl
              "
            >
              {menu.icon}
            </span>

            <span
              className="
                font-medium
              "
            >
              {menu.name}
            </span>
          </Link>
        ))}
      </nav>

      {/* Bottom */}

      <div
        className="
          mt-auto
          text-sm
          text-gray-400
        "
      >
        v1.0 Wealth OS
      </div>
    </aside>
  );
}