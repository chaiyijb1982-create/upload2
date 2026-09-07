"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AICFOLoginPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!password.trim()) {
      setError("请输入密码");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/ai-cfo/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.error || "密码错误");
        setLoading(false);
        return;
      }

      router.replace("/ai-cfo");
      router.refresh();
    } catch {
      setError("登录失败，请稍后重试");
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
        padding: 24,
        background: "#f5f5f5",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          borderRadius: 16,
          padding: 32,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          AI CFO
        </div>

        <div
          style={{
            color: "#666",
            fontSize: 14,
            marginBottom: 24,
          }}
        >
          Private access
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入访问密码"
            autoFocus
            style={{
              width: "100%",
              height: 46,
              padding: "0 14px",
              border: "1px solid #ddd",
              borderRadius: 10,
              outline: "none",
              fontSize: 16,
              boxSizing: "border-box",
            }}
          />

          {error && (
            <div
              style={{
                marginTop: 12,
                color: "#d00",
                fontSize: 14,
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
              height: 46,
              marginTop: 18,
              border: 0,
              borderRadius: 10,
              background: "#111",
              color: "#fff",
              fontSize: 16,
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "验证中..." : "进入 AI CFO"}
          </button>
        </form>
      </div>
    </main>
  );
}