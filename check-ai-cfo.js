const http = require("http");

const API_KEY = process.env.AI_CFO_API_KEY;

if (!API_KEY) {
  console.error("请先设置 AI_CFO_API_KEY 环境变量");
  process.exit(1);
}

const options = {
  hostname: "localhost",
  port: 3000,
  path: "/api/ai-cfo",
  method: "GET",
  headers: {
    Authorization: `Bearer ${API_KEY}`,
  },
};

const req = http.request(options, (res) => {
  let body = "";

  res.on("data", (chunk) => {
    body += chunk;
  });

  res.on("end", () => {
    try {
      const json = JSON.parse(body);

      if (!json.success) {
        console.error("API 错误：");
        console.error(json);
        return;
      }

      console.log("");
      console.log("========================================");
      console.log("        AI CFO 数据层核对");
      console.log("========================================");

      // =====================================================
      // Summary
      // =====================================================

      const summary = json.summary ?? {};

      console.log("");
      console.log("【AI CFO Summary】");

      console.log(
        "原始金融资产:",
        summary.raw_financial_assets
      );

      console.log(
        "固收:",
        summary.fixed_income
      );

      console.log(
        "Total Wealth:",
        summary.total_financial_assets
      );

      console.log(
        "全部负债:",
        summary.total_debt
      );

      console.log(
        "房贷:",
        summary.mortgage_debt
      );

      console.log(
        "非房贷负债:",
        summary.non_mortgage_debt
      );

      console.log(
        "真实净资产:",
        summary.net_worth
      );

      console.log(
        "Financial Freedom 负债:",
        summary.financial_freedom_debt
      );

      console.log(
        "Financial Freedom 净财富:",
        summary.financial_freedom_net_wealth
      );

      console.log(
        "Financial Freedom Target:",
        summary.financial_freedom_target
      );

      console.log(
        "Financial Freedom Gap:",
        summary.financial_freedom_gap
      );

      console.log(
        "Financial Freedom Rate:",
        summary.financial_freedom_rate + "%"
      );

      // =====================================================
      // Financial Overview
      // =====================================================

      console.log("");
      console.log("【Financial Overview】");

      console.log(
        JSON.stringify(
          json.financial_overview,
          null,
          2
        )
      );

      // =====================================================
      // Portfolio
      // =====================================================

      console.log("");
      console.log("【Portfolio】");

      console.log(
        "Holdings 数量:",
        json.portfolio?.holdings_count
      );

      console.log(
        "Holdings 金额:",
        json.portfolio?.holdings_amount
      );

      console.log(
        "Holdings 成本:",
        json.portfolio?.holdings_cost
      );

      console.log(
        "Holdings 盈亏:",
        json.portfolio?.holdings_profit
      );

      console.log("");
      console.log("资产分类:");

      console.log(
        JSON.stringify(
          json.portfolio?.by_category ?? [],
          null,
          2
        )
      );

      // =====================================================
      // Debt
      // =====================================================

      console.log("");
      console.log("【Debt】");

      console.log(
        JSON.stringify(
          json.debt,
          null,
          2
        )
      );

      // =====================================================
      // Financial Freedom
      // =====================================================

      console.log("");
      console.log("【Financial Freedom】");

      console.log(
        JSON.stringify(
          json.financial_freedom,
          null,
          2
        )
      );

      // =====================================================
      // FF 对账
      // =====================================================

      const reconciliation =
        json.financial_freedom
          ?.reconciliation;

      if (reconciliation) {
        console.log("");
        console.log("【Financial Freedom 对账】");

        console.log(
          "数据库 total_asset:",
          reconciliation.database_total_asset
        );

        console.log(
          "API 计算 total_asset:",
          reconciliation.calculated_total_asset
        );

        console.log(
          "差异:",
          reconciliation.difference
        );
      }

      // =====================================================
      // AI Context
      // =====================================================

      console.log("");
      console.log("【AI Context】");

      console.log(
        JSON.stringify(
          json.ai_context,
          null,
          2
        )
      );

      // =====================================================
      // Table Status
      // =====================================================

      console.log("");
      console.log("【数据表状态】");

      console.log(
        JSON.stringify(
          json.table_status,
          null,
          2
        )
      );

      console.log("");
      console.log("========================================");
      console.log("        核对完成");
      console.log("========================================");
      console.log("");

    } catch (error) {
      console.error("JSON 解析失败：");
      console.error(error);
      console.error("");
      console.error("服务器返回内容：");
      console.error(body);
    }
  });
});

req.on("error", (error) => {
  console.error("请求 AI CFO API 失败：");
  console.error(error);
});

req.end();