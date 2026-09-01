"use client";

import {
  ChangeEvent,
  useRef,
  useState,
} from "react";

import TopBar from "@/components/TopBar";

import {
  supabase,
} from "@/lib/supabase";


// =====================================================
// Supabase Storage
// =====================================================

const BUCKET_NAME = "frais-invoices";

const STORAGE_FOLDER = "incoming";


// =====================================================
// 类型
// =====================================================

type UploadItem = {
  id: string;
  file: File;
  status:
    | "waiting"
    | "uploading"
    | "success"
    | "error";
  message?: string;
};


// =====================================================
// 页面
// =====================================================

export default function FraisUploadPage() {

  // ===================================================
  // File Input
  // ===================================================

  const fileInputRef =
    useRef<HTMLInputElement | null>(null);


  // ===================================================
  // 上传列表
  // ===================================================

  const [
    uploadItems,
    setUploadItems,
  ] = useState<UploadItem[]>([]);


  // ===================================================
  // 总体状态
  // ===================================================

  const [
    uploading,
    setUploading,
  ] = useState(false);


  const [
    message,
    setMessage,
  ] = useState("");


  const [
    success,
    setSuccess,
  ] = useState<boolean | null>(null);


  // ===================================================
  // 打开文件选择器
  // ===================================================

  function handleChooseFiles() {

    fileInputRef.current?.click();

  }


  // ===================================================
  // 选择文件
  // ===================================================

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {

    const files =
      Array.from(
        event.target.files || []
      );


    if (files.length === 0) {
      return;
    }


    // =================================================
    // 检查文件类型
    // =================================================

    const validFiles =
      files.filter((file) => {

        const type =
          file.type.toLowerCase();

        return (
          type === "application/pdf" ||
          type === "image/jpeg" ||
          type === "image/jpg" ||
          type === "image/png"
        );

      });


    const invalidCount =
      files.length -
      validFiles.length;


    // =================================================
    // 创建上传项目
    // =================================================

    const newItems: UploadItem[] =
      validFiles.map(
        (file) => ({
          id:
            `${Date.now()}-${Math.random()
              .toString(36)
              .slice(2)}`,

          file,

          status: "waiting",
        })
      );


    setUploadItems(
      (previous) => [
        ...previous,
        ...newItems,
      ]
    );


    // =================================================
    // 提示
    // =================================================

    if (invalidCount > 0) {

      setMessage(
        `已忽略 ${invalidCount} 个不支持的文件，只支持 PDF / JPG / PNG`
      );

      setSuccess(false);

    } else {

      setMessage("");

      setSuccess(null);

    }


    // =================================================
    // 允许再次选择同一个文件
    // =================================================

    event.target.value = "";

  }


  // ===================================================
  // 删除等待中的文件
  // ===================================================

  function handleRemove(
    id: string
  ) {

    if (uploading) {
      return;
    }


    setUploadItems(
      (previous) =>
        previous.filter(
          (item) =>
            item.id !== id
        )
    );

  }


  // ===================================================
  // 清空列表
  // ===================================================

  function handleClear() {

    if (uploading) {
      return;
    }


    setUploadItems([]);

    setMessage("");

    setSuccess(null);

  }


  // ===================================================
  // 生成 Storage 文件名
  // ===================================================

  function createStorageFileName(
    file: File
  ): string {

    // =================================================
    // 获取扩展名
    // =================================================

    const extension =
      file.name.includes(".")
        ? file.name
            .split(".")
            .pop()
            ?.toLowerCase() || ""
        : "";


    // =================================================
    // 清理原始文件名
    // =================================================

    const originalName =
      file.name
        .replace(
          /\.[^/.]+$/,
          ""
        )
        .replace(
          /[^\w\u4e00-\u9fff.-]+/g,
          "_"
        );


    // =================================================
    // 时间戳
    // =================================================

    const timestamp =
      new Date()
        .toISOString()
        .replace(
          /[:.]/g,
          "-"
        );


    // =================================================
    // 随机字符串
    // =================================================

    const random =
      Math.random()
        .toString(36)
        .slice(2, 8);


    // =================================================
    // 最终文件名
    //
    // 例如：
    //
    // 2026-09-01T05-30-12-123Z-a8f31c-发票.pdf
    // =================================================

    return (
      `${timestamp}-${random}-${originalName}${
        extension
          ? `.${extension}`
          : ""
      }`
    );

  }


  // ===================================================
  // 上传单个文件
  // ===================================================

  async function uploadOne(
    item: UploadItem
  ) {

    // =================================================
    // 更新状态：上传中
    // =================================================

    setUploadItems(
      (previous) =>
        previous.map(
          (current) =>
            current.id === item.id
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

      const file =
        item.file;


      // =================================================
      // 生成 Storage 文件名
      // =================================================

      const storageFileName =
        createStorageFileName(
          file
        );


      // =================================================
      // 关键：
      //
      // 必须包含 incoming/
      //
      // 最终：
      //
      // frais-invoices/
      // └── incoming/
      //     └── xxx.pdf
      // =================================================

      const storagePath =
        `${STORAGE_FOLDER}/${storageFileName}`;


      console.log(
        "[FRAIS UPLOAD]",
        {
          bucket:
            BUCKET_NAME,

          folder:
            STORAGE_FOLDER,

          storagePath,

          originalName:
            file.name,
        }
      );


      // =================================================
      // 上传到 Supabase Storage
      // =================================================

      const {
        error,
      } =
        await supabase.storage
          .from(
            BUCKET_NAME
          )
          .upload(
            storagePath,
            file,
            {
              cacheControl:
                "3600",

              upsert:
                false,

              contentType:
                file.type ||
                undefined,
            }
          );


      // =================================================
      // 上传失败
      // =================================================

      if (error) {

        throw error;

      }


      // =================================================
      // 上传成功
      // =================================================

      setUploadItems(
        (previous) =>
          previous.map(
            (current) =>
              current.id === item.id
                ? {
                    ...current,

                    status:
                      "success",

                    message:
                      `已上传 · ${STORAGE_FOLDER}/`,
                  }
                : current
          )
      );


    } catch (error: any) {

      console.error(
        "FRAIS upload error:",
        error
      );


      // =================================================
      // 上传失败
      // =================================================

      setUploadItems(
        (previous) =>
          previous.map(
            (current) =>
              current.id === item.id
                ? {
                    ...current,

                    status:
                      "error",

                    message:
                      error?.message ||
                      "上传失败",
                  }
                : current
          )
      );

    }

  }


  // ===================================================
  // 上传全部
  // ===================================================

  async function handleUpload() {

    if (uploading) {
      return;
    }


    // =================================================
    // 找出等待上传文件
    // =================================================

    const waitingItems =
      uploadItems.filter(
        (item) =>
          item.status ===
          "waiting"
      );


    // =================================================
    // 没有文件
    // =================================================

    if (
      waitingItems.length === 0
    ) {

      setMessage(
        "没有需要上传的文件"
      );

      setSuccess(false);

      return;

    }


    // =================================================
    // 开始上传
    // =================================================

    setUploading(true);

    setMessage(
      `正在上传 ${waitingItems.length} 个文件...`
    );

    setSuccess(null);


    try {

      // =================================================
      // 一个一个上传
      //
      // 手机一次可以选择多个文件
      // =================================================

      for (
        const item of waitingItems
      ) {

        await uploadOne(
          item
        );

      }


      // =================================================
      // 完成
      // =================================================

      setMessage(
        `上传完成，共处理 ${waitingItems.length} 个文件`
      );

      setSuccess(true);


    } catch (error: any) {

      console.error(
        "FRAIS batch upload error:",
        error
      );


      setMessage(
        error?.message ||
        "上传过程中发生错误"
      );

      setSuccess(false);


    } finally {

      setUploading(false);

    }

  }


  // ===================================================
  // 统计
  // ===================================================

  const waitingCount =
    uploadItems.filter(
      (item) =>
        item.status ===
        "waiting"
    ).length;


  const uploadingCount =
    uploadItems.filter(
      (item) =>
        item.status ===
        "uploading"
    ).length;


  const successCount =
    uploadItems.filter(
      (item) =>
        item.status ===
        "success"
    ).length;


  const errorCount =
    uploadItems.filter(
      (item) =>
        item.status ===
        "error"
    ).length;


  // ===================================================
  // UI
  // ===================================================

  return (
    <>

      <TopBar
        title="FRAIS 发票上传"
      />


      <main
        className="
          min-h-screen
          bg-gray-50
          px-4
          py-6
          md:px-8
          md:py-8
        "
      >

        <div
          className="
            mx-auto
            max-w-4xl
          "
        >

          {/* =================================================
              标题
          ================================================= */}

          <div
            className="
              mb-6
            "
          >

            <h1
              className="
                text-2xl
                md:text-3xl
                font-bold
                text-gray-900
              "
            >
              FRAIS 发票上传
            </h1>


            <p
              className="
                mt-2
                text-sm
                text-gray-500
              "
            >
              手机直接上传发票到 Supabase Storage
            </p>


            <p
              className="
                mt-1
                text-xs
                text-gray-400
              "
            >
              上传位置：frais-invoices / incoming
            </p>

          </div>


          {/* =================================================
              上传区域
          ================================================= */}

          <section
            className="
              rounded-2xl
              bg-white
              border
              border-gray-200
              p-5
              md:p-8
              shadow-sm
            "
          >

            <input
              ref={fileInputRef}
              type="file"
              accept="
                application/pdf,
                image/jpeg,
                image/png
              "
              multiple
              onChange={
                handleFileChange
              }
              className="
                hidden
              "
            />


            {/* =================================================
                选择文件
            ================================================= */}

            <button
              type="button"
              onClick={
                handleChooseFiles
              }
              disabled={
                uploading
              }
              className="
                w-full
                rounded-2xl
                border-2
                border-dashed
                border-gray-300
                bg-gray-50
                px-6
                py-10
                text-center
                transition
                hover:border-blue-400
                hover:bg-blue-50
                active:bg-blue-100
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >

              <div
                className="
                  text-5xl
                "
              >
                📤
              </div>


              <div
                className="
                  mt-4
                  text-lg
                  font-semibold
                  text-gray-900
                "
              >
                选择发票
              </div>


              <div
                className="
                  mt-2
                  text-sm
                  text-gray-500
                "
              >
                可以一次选择多个 PDF / JPG / PNG
              </div>

            </button>


            {/* =================================================
                文件列表
            ================================================= */}

            {uploadItems.length > 0 && (

              <div
                className="
                  mt-6
                "
              >

                <div
                  className="
                    mb-3
                    flex
                    items-center
                    justify-between
                  "
                >

                  <div
                    className="
                      text-sm
                      font-semibold
                      text-gray-800
                    "
                  >
                    已选择 {uploadItems.length} 个文件
                  </div>


                  <button
                    type="button"
                    onClick={
                      handleClear
                    }
                    disabled={
                      uploading
                    }
                    className="
                      text-sm
                      text-gray-500
                      hover:text-red-500
                      disabled:opacity-50
                    "
                  >
                    清空
                  </button>

                </div>


                <div
                  className="
                    space-y-2
                  "
                >

                  {uploadItems.map(
                    (item) => (

                      <div
                        key={item.id}
                        className="
                          flex
                          items-center
                          gap-3
                          rounded-xl
                          border
                          border-gray-200
                          bg-gray-50
                          px-3
                          py-3
                        "
                      >

                        {/* 文件图标 */}

                        <div
                          className="
                            flex
                            h-10
                            w-10
                            shrink-0
                            items-center
                            justify-center
                            rounded-lg
                            bg-white
                            border
                            border-gray-200
                            text-lg
                          "
                        >
                          {item.file.type ===
                          "application/pdf"
                            ? "📄"
                            : "🧾"}
                        </div>


                        {/* 文件信息 */}

                        <div
                          className="
                            min-w-0
                            flex-1
                          "
                        >

                          <div
                            className="
                              truncate
                              text-sm
                              font-medium
                              text-gray-800
                            "
                          >
                            {item.file.name}
                          </div>


                          <div
                            className="
                              mt-1
                              text-xs
                              text-gray-400
                            "
                          >
                            {(
                              item.file.size /
                              1024
                            ).toFixed(1)}
                            {" KB"}
                          </div>


                          {item.message && (

                            <div
                              className={`

                                mt-1

                                text-xs

                                ${
                                  item.status ===
                                  "success"
                                    ? "text-green-600"
                                    : item.status ===
                                      "error"
                                    ? "text-red-500"
                                    : "text-gray-500"
                                }

                              `}
                            >
                              {item.message}
                            </div>

                          )}

                        </div>


                        {/* 状态 */}

                        <div
                          className="
                            shrink-0
                            text-lg
                          "
                        >

                          {item.status ===
                            "waiting" && (
                            <span>
                              ⏳
                            </span>
                          )}


                          {item.status ===
                            "uploading" && (
                            <span>
                              🔄
                            </span>
                          )}


                          {item.status ===
                            "success" && (
                            <span>
                              ✅
                            </span>
                          )}


                          {item.status ===
                            "error" && (
                            <span>
                              ❌
                            </span>
                          )}

                        </div>


                        {/* 删除 */}

                        {item.status ===
                          "waiting" && (

                          <button
                            type="button"
                            onClick={() =>
                              handleRemove(
                                item.id
                              )
                            }
                            disabled={
                              uploading
                            }
                            className="
                              shrink-0
                              rounded-lg
                              px-2
                              py-1
                              text-gray-400
                              hover:bg-red-50
                              hover:text-red-500
                            "
                            aria-label="删除文件"
                          >
                            ✕
                          </button>

                        )}

                      </div>

                    )
                  )}

                </div>

              </div>

            )}


            {/* =================================================
                上传按钮
            ================================================= */}

            <button
              type="button"
              onClick={
                handleUpload
              }
              disabled={
                uploading ||
                waitingCount === 0
              }
              className="
                mt-6
                w-full
                rounded-xl
                bg-blue-600
                px-5
                py-3.5
                font-semibold
                text-white
                transition
                hover:bg-blue-700
                active:bg-blue-800
                disabled:cursor-not-allowed
                disabled:bg-gray-300
              "
            >

              {uploading
                ? `正在上传${
                    uploadingCount > 0
                      ? ` · ${uploadingCount} 个`
                      : "..."
                  }`
                : `上传到 Supabase${
                    waitingCount > 0
                      ? ` · ${waitingCount} 个文件`
                      : ""
                  }`}

            </button>


            {/* =================================================
                结果
            ================================================= */}

            {message && (

              <div
                className={`

                  mt-4

                  rounded-xl

                  px-4

                  py-3

                  text-sm

                  ${
                    success === true
                      ? "bg-green-50 text-green-700"
                      : success === false
                      ? "bg-red-50 text-red-600"
                      : "bg-gray-50 text-gray-600"
                  }

                `}
              >
                {message}
              </div>

            )}


            {/* =================================================
                统计
            ================================================= */}

            {uploadItems.length > 0 && (

              <div
                className="
                  mt-5
                  grid
                  grid-cols-3
                  gap-2
                  text-center
                "
              >

                <div
                  className="
                    rounded-xl
                    bg-gray-50
                    px-3
                    py-3
                  "
                >

                  <div
                    className="
                      text-lg
                      font-bold
                      text-gray-800
                    "
                  >
                    {waitingCount}
                  </div>

                  <div
                    className="
                      mt-1
                      text-xs
                      text-gray-400
                    "
                  >
                    待上传
                  </div>

                </div>


                <div
                  className="
                    rounded-xl
                    bg-green-50
                    px-3
                    py-3
                  "
                >

                  <div
                    className="
                      text-lg
                      font-bold
                      text-green-600
                    "
                  >
                    {successCount}
                  </div>

                  <div
                    className="
                      mt-1
                      text-xs
                      text-green-500
                    "
                  >
                    已完成
                  </div>

                </div>


                <div
                  className="
                    rounded-xl
                    bg-red-50
                    px-3
                    py-3
                  "
                >

                  <div
                    className="
                      text-lg
                      font-bold
                      text-red-500
                    "
                  >
                    {errorCount}
                  </div>

                  <div
                    className="
                      mt-1
                      text-xs
                      text-red-400
                    "
                  >
                    失败
                  </div>

                </div>

              </div>

            )}


            {/* =================================================
                当前流程
            ================================================= */}

            <div
              className="
                mt-6
                rounded-xl
                bg-blue-50
                px-4
                py-4
                text-sm
                leading-6
                text-blue-700
              "
            >

              <div
                className="
                  font-semibold
                "
              >
                当前流程
              </div>


              <div
                className="
                  mt-1
                "
              >
                手机选择发票
                →
                上传到
                frais-invoices / incoming
              </div>


              <div
                className="
                  mt-1
                  text-xs
                  text-blue-500
                "
              >
                Windows 下载程序会自动读取 incoming 中的文件。
              </div>


              <div
                className="
                  mt-1
                  text-xs
                  text-blue-500
                "
              >
                下载并验证成功后，才会从 Supabase Storage 删除原文件。
              </div>


              <div
                className="
                  mt-1
                  text-xs
                  text-blue-500
                "
              >
                当前页面不会写入任何 FRAIS 数据表。
              </div>

            </div>

          </section>

        </div>

      </main>

    </>
  );

}