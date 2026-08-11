"use client";

import {
  FormEvent,
  useState,
} from "react";

import { useRouter } from "next/navigation";

export default function LoginPage() {

  const router = useRouter();

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {

    event.preventDefault();

    setError("");

    if (!username || !password) {
      setError("请输入账号和密码");
      return;
    }

    setLoading(true);

    try {

      const response =
        await fetch(
          "/api/auth/login",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              username,
              password,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok || !data.success) {
        setError(
          data?.message ||
          "登录失败"
        );

        setLoading(false);

        return;
      }

      router.replace("/");

      router.refresh();

    } catch {

      setError(
        "登录失败，请检查网络连接"
      );

      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #f5f7fa 0%, #e4e7eb 100%)",
        padding: "20px",
      }}
    >

      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          borderRadius: "18px",
          padding: "40px",
          boxShadow:
            "0 20px 60px rgba(0,0,0,0.12)",
        }}
      >

        <div
          style={{
            textAlign: "center",
            marginBottom: "32px",
          }}
        >

          <div
            style={{
              fontSize: "42px",
              marginBottom: "12px",
            }}
          >
            🔐
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "26px",
              fontWeight: 700,
              color: "#111827",
            }}
          >
            AI Wealth OS
          </h1>

          <p
            style={{
              marginTop: "8px",
              marginBottom: 0,
              color: "#6b7280",
              fontSize: "14px",
            }}
          >
            私人财富管理系统
          </p>

        </div>

        <form
          onSubmit={handleSubmit}
        >

          <div
            style={{
              marginBottom: "18px",
            }}
          >

            <label
              style={{
                display: "block",
                marginBottom: "7px",
                fontSize: "14px",
                fontWeight: 600,
                color: "#374151",
              }}
            >
              账号
            </label>

            <input
              value={username}
              onChange={(event) =>
                setUsername(
                  event.target.value
                )
              }
              autoComplete="username"
              placeholder="请输入账号"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding:
                  "12px 14px",
                border:
                  "1px solid #d1d5db",
                borderRadius: "10px",
                fontSize: "15px",
                outline: "none",
              }}
            />

          </div>

          <div
            style={{
              marginBottom: "18px",
            }}
          >

            <label
              style={{
                display: "block",
                marginBottom: "7px",
                fontSize: "14px",
                fontWeight: 600,
                color: "#374151",
              }}
            >
              密码
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              autoComplete="current-password"
              placeholder="请输入密码"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding:
                  "12px 14px",
                border:
                  "1px solid #d1d5db",
                borderRadius: "10px",
                fontSize: "15px",
                outline: "none",
              }}
            />

          </div>

          {error && (
            <div
              style={{
                marginBottom: "18px",
                padding:
                  "10px 12px",
                borderRadius: "8px",
                background: "#fef2f2",
                color: "#dc2626",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding:
                "13px 16px",
              border: "none",
              borderRadius: "10px",
              background:
                loading
                  ? "#9ca3af"
                  : "#111827",
              color: "#ffffff",
              fontSize: "15px",
              fontWeight: 600,
              cursor:
                loading
                  ? "default"
                  : "pointer",
            }}
          >
            {loading
              ? "登录中..."
              : "登录"}
          </button>

        </form>

      </div>

    </main>
  );
}