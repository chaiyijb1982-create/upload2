@echo off
setlocal EnableExtensions

title AI Wealth OS -> upload2-public -> GitHub -> Vercel

set "SOURCE=C:\Users\cyjtd\AI-Wealth-OS"
set "TARGET=C:\Users\cyjtd\upload2-public"

echo.
echo ============================================================
echo       AI Wealth OS -> upload2-public -> GitHub -> Vercel
echo ============================================================
echo.

if not exist "%SOURCE%\" (
    echo [ERROR] 源目录不存在：
    echo %SOURCE%
    echo.
    pause
    exit /b 1
)

if not exist "%TARGET%\" (
    echo [ERROR] 目标目录不存在：
    echo %TARGET%
    echo.
    pause
    exit /b 1
)

echo [1/5] 复制核心项目目录...
echo.

REM ============================================================
REM 只复制这些目录
REM 不复制整个 AI-Wealth-OS
REM ============================================================

echo   app
robocopy "%SOURCE%\app" "%TARGET%\app" /E /COPY:DAT /DCOPY:DAT /R:2 /W:1

if %ERRORLEVEL% GEQ 8 (
    echo [ERROR] app 复制失败
    pause
    exit /b 1
)

echo   components
robocopy "%SOURCE%\components" "%TARGET%\components" /E /COPY:DAT /DCOPY:DAT /R:2 /W:1

if %ERRORLEVEL% GEQ 8 (
    echo [ERROR] components 复制失败
    pause
    exit /b 1
)

echo   lib
robocopy "%SOURCE%\lib" "%TARGET%\lib" /E /COPY:DAT /DCOPY:DAT /R:2 /W:1

if %ERRORLEVEL% GEQ 8 (
    echo [ERROR] lib 复制失败
    pause
    exit /b 1
)

echo   public
if exist "%SOURCE%\public\" (
    robocopy "%SOURCE%\public" "%TARGET%\public" /E /COPY:DAT /DCOPY:DAT /R:2 /W:1

    if %ERRORLEVEL% GEQ 8 (
        echo [ERROR] public 复制失败
        pause
        exit /b 1
    )
) else (
    echo   public 不存在，跳过
)

echo.
echo [2/5] 复制必要配置文件...
echo.

REM ============================================================
REM 根目录必要文件
REM
REM 不复制：
REM .env
REM .env.local
REM node_modules
REM .next
REM .git
REM 各种私人文件
REM ============================================================

if exist "%SOURCE%\package.json" (
    copy /Y "%SOURCE%\package.json" "%TARGET%\package.json" >nul
    echo   package.json
)

if exist "%SOURCE%\package-lock.json" (
    copy /Y "%SOURCE%\package-lock.json" "%TARGET%\package-lock.json" >nul
    echo   package-lock.json
)

if exist "%SOURCE%\tsconfig.json" (
    copy /Y "%SOURCE%\tsconfig.json" "%TARGET%\tsconfig.json" >nul
    echo   tsconfig.json
)

if exist "%SOURCE%\next.config.js" (
    copy /Y "%SOURCE%\next.config.js" "%TARGET%\next.config.js" >nul
    echo   next.config.js
)

if exist "%SOURCE%\next.config.mjs" (
    copy /Y "%SOURCE%\next.config.mjs" "%TARGET%\next.config.mjs" >nul
    echo   next.config.mjs
)

if exist "%SOURCE%\next.config.ts" (
    copy /Y "%SOURCE%\next.config.ts" "%TARGET%\next.config.ts" >nul
    echo   next.config.ts
)

if exist "%SOURCE%\postcss.config.js" (
    copy /Y "%SOURCE%\postcss.config.js" "%TARGET%\postcss.config.js" >nul
    echo   postcss.config.js
)

if exist "%SOURCE%\postcss.config.mjs" (
    copy /Y "%SOURCE%\postcss.config.mjs" "%TARGET%\postcss.config.mjs" >nul
    echo   postcss.config.mjs
)

if exist "%SOURCE%\postcss.config.ts" (
    copy /Y "%SOURCE%\postcss.config.ts" "%TARGET%\postcss.config.ts" >nul
    echo   postcss.config.ts
)

if exist "%SOURCE%\tailwind.config.js" (
    copy /Y "%SOURCE%\tailwind.config.js" "%TARGET%\tailwind.config.js" >nul
    echo   tailwind.config.js
)

if exist "%SOURCE%\tailwind.config.ts" (
    copy /Y "%SOURCE%\tailwind.config.ts" "%TARGET%\tailwind.config.ts" >nul
    echo   tailwind.config.ts
)

if exist "%SOURCE%\middleware.ts" (
    copy /Y "%SOURCE%\middleware.ts" "%TARGET%\middleware.ts" >nul
    echo   middleware.ts
)

if exist "%SOURCE%\middleware.js" (
    copy /Y "%SOURCE%\middleware.js" "%TARGET%\middleware.js" >nul
    echo   middleware.js
)

if exist "%SOURCE%\eslint.config.mjs" (
    copy /Y "%SOURCE%\eslint.config.mjs" "%TARGET%\eslint.config.mjs" >nul
    echo   eslint.config.mjs
)

if exist "%SOURCE%\eslint.config.js" (
    copy /Y "%SOURCE%\eslint.config.js" "%TARGET%\eslint.config.js" >nul
    echo   eslint.config.js
)

echo.
echo ============================================================
echo 已复制：
echo   app
echo   components
echo   lib
echo   public（如果存在）
echo   必要 Next.js 配置文件
echo.
echo 未复制：
echo   .env / .env.local / .env.*
echo   node_modules
echo   .next
echo   .git
echo   其他根目录私人文件
echo ============================================================
echo.

cd /d "%TARGET%"

echo [3/5] 检查 Git 仓库...
echo.

if not exist ".git\" (
    echo [ERROR] upload2-public 没有 .git
    echo.
    echo 当前目录：
    echo %TARGET%
    echo.
    pause
    exit /b 1
)

echo 当前 Git Remote：
echo.
git remote -v
echo.

echo [4/5] Git Add...
echo.

git add -A

if errorlevel 1 (
    echo.
    echo [ERROR] git add 失败
    pause
    exit /b 1
)

echo.
echo 当前修改：
echo.
git status

echo.
echo ============================================================
echo 检查是否有需要提交的修改
echo ============================================================
echo.

git diff --cached --quiet

if %ERRORLEVEL% EQU 0 (
    echo 没有新的修改。
    echo 不创建 Commit。
    echo.
) else (
    echo 正在 Commit...
    echo.

    git commit -m "Sync AI Wealth OS"

    if errorlevel 1 (
        echo.
        echo [ERROR] git commit 失败
        pause
        exit /b 1
    )

    echo.
    echo Commit 成功。
)

echo.
echo [5/5] Push 到 GitHub...
echo.

git push origin main

if errorlevel 1 (
    echo.
    echo ============================================================
    echo [ERROR] GitHub Push 失败
    echo ============================================================
    echo.
    echo 请检查上面的 Git 错误信息。
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo                    PUSH 成功！
echo ============================================================
echo.
echo upload2-public 已经 Push 到 GitHub。
echo.
echo 如果 Vercel 已连接 GitHub 的 main 分支，
echo Vercel 会自动开始部署。
echo.
echo ============================================================
echo.

pause
endlocal

