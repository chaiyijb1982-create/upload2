"use client";

import {
  ChangeEvent,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";


// =====================================================
// 类型
// =====================================================

type UploadResult = {
  file: File;
  status:
    | "waiting"
    | "uploading"
    | "success"
    | "duplicate"
    | "failed";
  message: string;
};


// =====================================================
// 工具
// =====================================================

function isSupportedFile(file: File) {
  return (
    file.type === "application/pdf" ||
    file.type === "image/jpeg" ||
    file.type === "image/png" ||
    file.name.toLowerCase().endsWith(".pdf") ||
    file.name.toLowerCase().endsWith(".jpg") ||
    file.name.toLowerCase().endsWith(".jpeg") ||
    file.name.toLowerCase().endsWith(".png")
  );
}


// =====================================================
// SHA-256
// =====================================================

async function calculateHash(
  file: File
) {
  const buffer =
    await file.arrayBuffer();

  const hashBuffer =
    await crypto.subtle.digest(
      "SHA-256",
      buffer
    );

  const hashArray =
    Array.from(
      new Uint8Array(hashBuffer)
    );

  return hashArray
    .map((byte) =>
      byte
        .toString(16)
        .padStart(2, "0")
    )
    .join("");
}


// =====================================================
// 页面
// =====================================================

export default function FraisUploadPage() {
  const [
    files,
    setFiles,
  ] = useState<UploadResult[]>([]);

  const [
    uploading,
    setUploading,
  ] = useState(false);

  const [
    summary,
    setSummary,
  ] = useState("");


  // ===================================================
  // 选择文件
  // ===================================================

  function handleFiles(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const selected =
      Array.from(
        event.target.files || []
      );

    const valid =
      selected.filter(
        isSupportedFile
      );

    if (valid.length === 0) {
      alert(
        "没有找到支持的发票文件。"
      );
      return;
    }

    setFiles(
      valid.map(
        (file) => ({
          file,
          status: "waiting",
          message: "",
        })
      )
    );

    setSummary(
      `已选择 ${valid.length} 张发票`
    );

    event.target.value = "";
  }


  // ===================================================
  // 上传
  // ===================================================

  async function uploadAll() {
    if (
      files.length === 0
    ) {
      alert(
        "请先选择发票。"
      );
      return;
    }

    setUploading(true);

    let success = 0;
    let duplicate = 0;
    let failed = 0;

    for (
      let i = 0;
      i < files.length;
      i++
    ) {
      const item =
        files[i];

      setFiles(
        previous =>
          previous.map(
            (current, index) =>
              index === i
                ? {
                    ...current,
                    status:
                      "uploading",
                    message:
                      "正在上传...",
                  }
                : current
          )
      );

      try {
        const hash =
          await calculateHash(
            item.file
          );


        // ---------------------------------------------
        // 第一层：文件 Hash
        // ---------------------------------------------

        const {
          data:
            existingByHash,
        } =
          await supabase
            .from(
              "frais_invoices"
            )
            .select(
              "id"
            )
            .eq(
              "file_hash",
              hash
            )
            .maybeSingle();


        if (
          existingByHash
        ) {
          duplicate++;

          setFiles(
            previous =>
              previous.map(
                (
                  current,
                  index
                ) =>
                  index === i
                    ? {
                        ...current,
                        status:
                          "duplicate",
                        message:
                          "已经存在，跳过",
                      }
                    : current
              )
          );

          continue;
        }


        // ---------------------------------------------
        // 第二层：历史已使用 Hash
        // ---------------------------------------------

        const {
          data:
            usedByHash,
        } =
          await supabase
            .from(
              "frais_used_invoices"
            )
            .select(
              "id"
            )
            .eq(
              "file_hash",
              hash
            )
            .maybeSingle();


        if (
          usedByHash
        ) {
          duplicate++;

          setFiles(
            previous =>
              previous.map(
                (
                  current,
                  index
                ) =>
                  index === i
                    ? {
                        ...current,
                        status:
                          "duplicate",
                        message:
                          "以前已经使用过，跳过",
                      }
                    : current
              )
          );

          continue;
        }


        // ---------------------------------------------
        // Storage 路径
        // ---------------------------------------------

        const extension =
          item.file.name
            .split(".")
            .pop()
            ?.toLowerCase() ||
          "file";

        const filePath =
          `${new Date().getFullYear()}/` +
          `${Date.now()}-${crypto.randomUUID()}.${extension}`;


        // ---------------------------------------------
        // 上传 Storage
        // ---------------------------------------------

        const {
          error:
            uploadError,
        } =
          await supabase.storage
            .from(
              "frais-invoices"
            )
            .upload(
              filePath,
              item.file,
              {
                upsert: false,
                contentType:
                  item.file.type ||
                  "application/octet-stream",
              }
            );


        if (
          uploadError
        ) {
          throw uploadError;
        }


        // ---------------------------------------------
        // 写入数据库
        // ---------------------------------------------

        const {
          error:
            insertError,
        } =
          await supabase
            .from(
              "frais_invoices"
            )
            .insert({
              file_name:
                item.file.name,

              file_path:
                filePath,

              file_hash:
                hash,

              status:
                "unused",
            });


        if (
          insertError
        ) {
          await supabase.storage
            .from(
              "frais-invoices"
            )
            .remove([
              filePath,
            ]);

          throw insertError;
        }


        success++;

        setFiles(
          previous =>
            previous.map(
              (
                current,
                index
              ) =>
                index === i
                  ? {
                      ...current,
                      status:
                        "success",
                      message:
                        "上传成功",
                    }
                  : current
            )
        );
      } catch (error) {
        console.error(
          error
        );

        failed++;

        setFiles(
          previous =>
            previous.map(
              (
                current,
                index
              ) =>
                index === i
                  ? {
                      ...current,
                      status:
                        "failed",
                      message:
                        "上传失败",
                    }
                  : current
            )
        );
      }
    }

    setSummary(
      `完成：新增 ${success} 张，跳过 ${duplicate} 张，失败 ${failed} 张`
    );

    setUploading(false);
  }


  // ===================================================
  // UI
  // ===================================================

  return (
    <main
      style={{
        minHeight:
          "100vh",
        background:
          "#f5f7fa",
        padding:
          "24px",
      }}
    >
      <div
        style={{
          maxWidth:
            "700px",
          margin:
            "0 auto",
        }}
      >

        <div
          style={{
            background:
              "#ffffff",
            borderRadius:
              "18px",
            padding:
              "28px",
            boxShadow:
              "0 4px 20px rgba(0,0,0,0.06)",
          }}
        >

          <h1
            style={{
              fontSize:
                "28px",
              margin:
                "0 0 8px",
            }}
          >
            📱 FRAIS 发票上传
          </h1>

          <p
            style={{
              color:
                "#6b7280",
              marginBottom:
                "24px",
            }}
          >
            手机一次选择全部发票，系统会自动跳过已经存在或以前使用过的发票。
          </p>


          <input
            id="frais-file-input"
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={
              handleFiles
            }
            style={{
              display:
                "none",
            }}
          />


          <label
            htmlFor="frais-file-input"
            style={{
              display:
                "block",
              textAlign:
                "center",
              padding:
                "35px 20px",
              border:
                "2px dashed #9ca3af",
              borderRadius:
                "14px",
              background:
                "#fafafa",
              cursor:
                "pointer",
              fontSize:
                "18px",
              fontWeight:
                700,
            }}
          >
            ＋ 选择手机里的全部发票
          </label>


          {summary && (
            <div
              style={{
                marginTop:
                  "18px",
                padding:
                  "14px",
                background:
                  "#eff6ff",
                borderRadius:
                  "10px",
                color:
                  "#1d4ed8",
              }}
            >
              {summary}
            </div>
          )}


          {files.length >
            0 && (
            <div
              style={{
                marginTop:
                  "20px",
              }}
            >

              <div
                style={{
                  marginBottom:
                    "12px",
                  fontWeight:
                    700,
                }}
              >
                本次选择：
                {" "}
                {files.length}
                {" "}
                张
              </div>


              <div
                style={{
                  maxHeight:
                    "350px",
                  overflowY:
                    "auto",
                }}
              >

                {files.map(
                  (
                    item,
                    index
                  ) => (
                    <div
                      key={
                        index
                      }
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "center",
                        padding:
                          "10px",
                        borderBottom:
                          "1px solid #eee",
                        gap:
                          "10px",
                      }}
                    >

                      <div
                        style={{
                          overflow:
                            "hidden",
                          textOverflow:
                            "ellipsis",
                          whiteSpace:
                            "nowrap",
                          flex:
                            1,
                        }}
                      >
                        {
                          item
                            .file
                            .name
                        }
                      </div>


                      <div
                        style={{
                          fontSize:
                            "13px",
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        {item.status ===
                          "waiting" &&
                          "待上传"}

                        {item.status ===
                          "uploading" &&
                          "上传中..."}

                        {item.status ===
                          "success" &&
                          "✓ 成功"}

                        {item.status ===
                          "duplicate" &&
                          "↩ 跳过"}

                        {item.status ===
                          "failed" &&
                          "⚠ 失败"}
                      </div>

                    </div>
                  )
                )}

              </div>


              <button
                onClick={
                  uploadAll
                }
                disabled={
                  uploading
                }
                style={{
                  width:
                    "100%",
                  marginTop:
                    "20px",
                  padding:
                    "15px",
                  border:
                    "none",
                  borderRadius:
                    "10px",
                  background:
                    uploading
                      ? "#9ca3af"
                      : "#111827",
                  color:
                    "#ffffff",
                  fontSize:
                    "16px",
                  fontWeight:
                    700,
                }}
              >
                {uploading
                  ? "正在上传..."
                  : "上传全部发票"}
              </button>

            </div>
          )}

        </div>

      </div>
    </main>
  );
}