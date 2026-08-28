"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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
  // 信用卡实际账单导入
  // =====================================================

  {
    id: 9,
    name: "信用卡实际账单导入",
    href: "/credit-card-import",
    icon: "📥",
  },

  // =====================================================
  // 每月储蓄金（预估）
  // =====================================================

  {
    id: 10,
    name: "每月储蓄金(预估)",
    href: "/monthly-savings-estimate",
    icon: "💰",
  },

  // =====================================================
  // 每月储蓄金（实际）
  // =====================================================

  {
    id: 11,
    name: "每月储蓄金(实际)",
    href: "/monthly-savings-actual",
    icon: "💰",
  },

  // =====================================================
  // 消费明细
  // =====================================================

  {
    id: 12,
    name: "消费明细",
    href: "/expense",
    icon: "🧾",
  },

  // =====================================================
  // 保险
  // =====================================================

  {
    id: 13,
    name: "保险",
    href: "/insurance",
    icon: "🛡️",
  },

  // =====================================================
  // 财务自由规划
  // =====================================================

  {
    id: 14,
    name: "财务自由规划",
    href: "/financial-freedom",
    icon: "💎",
  },

  // =====================================================
  // 财务自由历史
  // =====================================================

  {
    id: 15,
    name: "财务自由历史",
    href: "/financial-freedom-history",
    icon: "💎",
    subMenu: true,
  },

  // =====================================================
  // 天天向上
  // =====================================================

  {
    id: 16,
    name: "天天向上当前",
    href: "/tiantian-up",
    icon: "🚀",
  },

  {
    id: 17,
    name: "天天向上年度详细",
    href: "/tiantian-up-detail",
    icon: "🚀",
  },

  // =====================================================
  // 退休规划
  // =====================================================

  {
    id: 18,
    name: "退休规划",
    href: "/retirement",
    icon: "🎯",
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  // =====================================================
  // 手机端 Sidebar 开关
  // =====================================================

  const [mobileOpen, setMobileOpen] =
    useState(false);

  // =====================================================
  // 手动更新状态
  // =====================================================

  const [updating, setUpdating] =
    useState(false);

  const [updateMessage, setUpdateMessage] =
    useState("");

  const [updateSuccess, setUpdateSuccess] =
    useState<boolean | null>(null);

  // =====================================================
  // 页面切换后自动关闭手机 Sidebar
  // =====================================================

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // =====================================================
  // 手机端打开 Sidebar 时禁止背景滚动
  // =====================================================

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // =====================================================
  // ESC 关闭
  // =====================================================

  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (
        event.key === "Escape"
      ) {
        setMobileOpen(false);
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, []);

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

  // =====================================================
  // Sidebar 内容
  // =====================================================

  const sidebarContent = (
    <div
      className="
        h-full
        flex
        flex-col
      "
    >
      {/* =================================================
          Logo
      ================================================= */}

      <div
        className="
          mb-8
          shrink-0
        "
      >
        <div
          className="
            flex
            items-center
            justify-between
          "
        >
          <div>
            <h1
              className="
                text-2xl
                font-bold
                text-gray-900
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
              手机端关闭按钮
          ================================================= */}

          <button
            type="button"
            onClick={() =>
              setMobileOpen(false)
            }
            className="
              md:hidden
              w-10
              h-10
              flex
              items-center
              justify-center
              rounded-xl
              text-gray-500
              hover:bg-gray-100
              active:bg-gray-200
              text-xl
            "
            aria-label="关闭菜单"
          >
            ✕
          </button>
        </div>
      </div>

      {/* =================================================
          Menu Scroll Area
      ================================================= */}

      <nav
        className="
          flex-1
          min-h-0
          overflow-y-auto
          space-y-3
          pr-1

          scrollbar-thin
          scrollbar-thumb-gray-300
          scrollbar-track-transparent
        "
      >
        {menus.map((menu) => {
          // =================================================
          // 当前页面
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
                onClick={() =>
                  setMobileOpen(false)
                }
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
                    shrink-0
                  "
                >
                  {menu.icon}
                </span>

                <span
                  className="
                    text-sm
                    font-medium
                    whitespace-nowrap
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
              onClick={() =>
                setMobileOpen(false)
              }
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
                  shrink-0
                "
              >
                {menu.icon}
              </span>

              <span
                className="
                  font-medium
                  whitespace-nowrap
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
          <span
            className="
              text-xl
              shrink-0
            "
          >
            {updating
              ? "⏳"
              : "🔄"}
          </span>

          <span
            className="
              font-medium
              whitespace-nowrap
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
              pb-2

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
          shrink-0
          pt-4
          mt-4
          border-t
          border-gray-100
          text-sm
          text-gray-400
        "
      >
        v1.0 Wealth OS
      </div>
    </div>
  );

  return (
    <>
      {/* ===================================================
          PC Sidebar
          
          md 以上显示
          手机完全隐藏
      =================================================== */}

      <aside
        className="
          hidden
          md:block
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
        "
      >
        {sidebarContent}
      </aside>

      {/* ===================================================
          手机顶部 Header
          
          手机才显示
      =================================================== */}

      <header
        className="
          md:hidden
          fixed
          top-0
          left-0
          right-0
          z-40
          h-16
          bg-white
          border-b
          border-gray-200
          px-4
          flex
          items-center
          justify-between
        "
      >
        <button
          type="button"
          onClick={() =>
            setMobileOpen(true)
          }
          className="
            w-10
            h-10
            flex
            items-center
            justify-center
            rounded-xl
            text-gray-700
            hover:bg-gray-100
            active:bg-gray-200
            text-2xl
          "
          aria-label="打开菜单"
        >
          ☰
        </button>

        <div
          className="
            flex-1
            ml-3
          "
        >
          <div
            className="
              text-lg
              font-bold
              text-gray-900
            "
          >
            AI Wealth OS
          </div>
        </div>
      </header>

      {/* ===================================================
          手机遮罩
          
          Sidebar 打开后显示
      =================================================== */}

      {mobileOpen && (
        <div
          className="
            md:hidden
            fixed
            inset-0
            z-[60]
            bg-black/40
          "
          onClick={() =>
            setMobileOpen(false)
          }
        />
      )}

      {/* ===================================================
          手机 Sidebar Drawer
      =================================================== */}

      <aside
        className={`
          md:hidden
          fixed
          left-0
          top-0
          z-[70]
          w-[82vw]
          max-w-[320px]
          h-screen
          bg-white
          border-r
          border-gray-200
          p-5

          transform
          transition-transform
          duration-300
          ease-in-out

          ${
            mobileOpen
              ? "translate-x-0"
              : "-translate-x-full"
          }
        `}
      >
        {sidebarContent}
      </aside>
    </>
  );
}