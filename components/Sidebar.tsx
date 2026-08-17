"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

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

  // =====================================================
  // 贷款
  // =====================================================

  {
    id: 5,
    name: "贷款",
    href: "/loan",
    icon: "💰",
  },

  // =====================================================
  // 贷款 Institutions
  // =====================================================

  {
    id: 6,
    name: "贷款insitutions",
    href: "/loan-institutions",
    icon: "🏛️",
    subMenu: true,
  },

  // =====================================================
  // 信用卡（手动预估）
  // =====================================================

  {
    id: 7,
    name: "信用卡(手动预估)",
    href: "/credit-card",
    icon: "💳",
  },

  // =====================================================
  // 信用卡（有鱼预估）
  // =====================================================

  {
    id: 8,
    name: "信用卡(有鱼预估)",
    href: "/credit-card-from-yu",
    icon: "💳",
  },

  // =====================================================
  // 消费明细
  // =====================================================

  {
    id: 9,
    name: "消费明细",
    href: "/expense",
    icon: "🧾",
  },

  // =====================================================
  // 保险
  // =====================================================

  {
    id: 10,
    name: "保险",
    href: "/insurance",
    icon: "🛡️",
  },

  // =====================================================
  // 财务自由规划
  // =====================================================

  {
    id: 11,
    name: "财务自由规划",
    href: "/financial-freedom",
    icon: "💎",
  },

  // =====================================================
  // 财务自由历史
  // =====================================================

  {
    id: 12,
    name: "财务自由历史",
    href: "/financial-freedom-history",
    icon: "💎",
    subMenu: true,
  },

  // =====================================================
  // 天天向上
  // =====================================================

  {
    id: 13,
    name: "天天向上当前",
    href: "/tiantian-up",
    icon: "🚀",
  },

  {
    id: 14,
    name: "天天向上年度详细",
    href: "/tiantian-up-detail",
    icon: "🚀",
  },

  // =====================================================
  // 退休规划
  // =====================================================

  {
    id: 15,
    name: "退休规划",
    href: "/retirement",
    icon: "🎯",
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  const [updating, setUpdating] =
    useState(false);

  const [updateMessage, setUpdateMessage] =
    useState("");

  const [updateSuccess, setUpdateSuccess] =
    useState<boolean | null>(null);

  // =====================================================
  // 手动更新全球资产
  // =====================================================

  async function handleManualUpdate() {
    if (updating) {
      return;
    }

    setUpdating(true);
    setUpdateMessage("正在更新...");
    setUpdateSuccess(null);

    try {
      const response =
        await fetch(
          "/api/cron/update-market",
          {
            method: "GET",
            cache: "no-store",
          }
        );

      const data =
        await response.json();

      if (
        response.ok &&
        data?.success
      ) {
        setUpdateSuccess(true);

        setUpdateMessage(
          `更新完成 · ${data.updated ?? 0} 项`
        );

        setTimeout(() => {
          window.location.reload();
        }, 1200);

        return;
      }

      setUpdateSuccess(false);

      setUpdateMessage(
        data?.error ||
          `更新失败${
            data?.failed
              ? ` · ${data.failed} 项失败`
              : ""
          }`
      );

    } catch (error: any) {
      console.error(
        "Manual update error:",
        error
      );

      setUpdateSuccess(false);

      setUpdateMessage(
        error?.message ||
          "更新失败"
      );

    } finally {
      setUpdating(false);
    }
  }

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

      {/* =================================================
          Logo
      ================================================= */}

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


      {/* =================================================
          Menu
      ================================================= */}

      <nav className="space-y-3">

        {menus.map((menu) => {

          // =================================================
          // 判断当前页面
          // =================================================

          const isActive =
            pathname === menu.href;


          // =================================================
          // 子菜单
          // =================================================

          if (menu.subMenu) {

            return (
              <Link
                key={menu.id}
                href={menu.href}
                className={`
                  flex
                  items-center
                  gap-3
                  ml-6
                  px-4
                  py-2.5
                  rounded-xl
                  transition

                  ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }
                `}
              >

                <span
                  className="
                    text-lg
                  "
                >
                  {menu.icon}
                </span>

                <span
                  className="
                    text-sm
                    font-medium
                  "
                >
                  {menu.name}
                </span>

              </Link>
            );
          }


          // =================================================
          // 普通菜单
          // =================================================

          return (
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
                  isActive
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
          );

        })}


        {/* =================================================
            手动更新
        ================================================= */}

        <button
          type="button"
          onClick={
            handleManualUpdate
          }
          disabled={
            updating
          }
          className={`
            w-full
            flex
            items-center
            gap-4
            px-4
            py-3
            rounded-xl
            transition
            text-left

            ${
              updating
                ? "bg-gray-100 text-gray-400 cursor-wait"
                : "text-gray-700 hover:bg-gray-100"
            }
          `}
        >

          <span className="text-xl">

            {updating
              ? "⏳"
              : "🔄"}

          </span>

          <span
            className="
              font-medium
            "
          >
            {updating
              ? "正在更新..."
              : "手动更新"}
          </span>

        </button>


        {/* =================================================
            更新结果
        ================================================= */}

        {updateMessage && (

          <div
            className={`
              px-4
              text-xs
              leading-5

              ${
                updateSuccess === true
                  ? "text-green-600"
                  : updateSuccess === false
                  ? "text-red-500"
                  : "text-gray-500"
              }
            `}
          >
            {updateMessage}
          </div>

        )}

      </nav>


      {/* =================================================
          Bottom
      ================================================= */}

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