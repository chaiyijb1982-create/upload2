$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================================"
Write-Host " AI Wealth OS - Native Currency Update"
Write-Host "============================================================"
Write-Host ""

# ============================================================
# Locate project root
# ============================================================

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if ((Split-Path -Leaf $ScriptDir) -eq "app") {
    $ProjectRoot = Split-Path -Parent $ScriptDir
}
else {
    $ProjectRoot = $ScriptDir
}

$PagePath = Join-Path $ProjectRoot "app\asset-management\page.tsx"
$AssetPath = Join-Path $ProjectRoot "lib\asset.ts"

Write-Host "Project root:"
Write-Host $ProjectRoot
Write-Host ""

# ============================================================
# Check files
# ============================================================

if (!(Test-Path $PagePath)) {
    throw "Cannot find page.tsx: $PagePath"
}

if (!(Test-Path $AssetPath)) {
    throw "Cannot find asset.ts: $AssetPath"
}

Write-Host "[OK] page.tsx found"
Write-Host "[OK] asset.ts found"
Write-Host ""

# ============================================================
# GitHub raw URLs
# ============================================================

$PageUrl = "https://raw.githubusercontent.com/chaiyijb1982-create/AI-Wealth-OS-upload/main/page.tsx"
$AssetUrl = "https://raw.githubusercontent.com/chaiyijb1982-create/AI-Wealth-OS-upload/main/asset.ts"

$TempPage = Join-Path $env:TEMP "ai-wealth-page-native.tsx"
$TempAsset = Join-Path $env:TEMP "ai-wealth-asset-native.ts"

# ============================================================
# Download GitHub versions
# ============================================================

Write-Host "[1] Downloading GitHub page.tsx..."

Invoke-WebRequest `
    -Uri $PageUrl `
    -OutFile $TempPage `
    -UseBasicParsing

Write-Host "[OK] page.tsx downloaded"

Write-Host "[2] Downloading GitHub asset.ts..."

Invoke-WebRequest `
    -Uri $AssetUrl `
    -OutFile $TempAsset `
    -UseBasicParsing

Write-Host "[OK] asset.ts downloaded"
Write-Host ""

# ============================================================
# Read UTF-8
# ============================================================

$page = [System.IO.File]::ReadAllText(
    $TempPage,
    [System.Text.Encoding]::UTF8
)

$asset = [System.IO.File]::ReadAllText(
    $TempAsset,
    [System.Text.Encoding]::UTF8
)

# ============================================================
# Basic structure checks
# ============================================================

Write-Host "[3] Checking GitHub source structure..."

if ($page -notmatch "type SortKey") {
    throw "page.tsx structure check failed: type SortKey not found"
}

if ($page -notmatch "type Holding") {
    throw "page.tsx structure check failed: type Holding not found"
}

if ($page -notmatch "function AssetRegionTable") {
    throw "page.tsx structure check failed: AssetRegionTable not found"
}

if ($page -notmatch 'title="香港资产"') {
    throw "page.tsx structure check failed: Hong Kong table not found"
}

if ($asset -notmatch "export type Holding") {
    throw "asset.ts structure check failed: Holding type not found"
}

if ($asset -notmatch "export async function getHoldings") {
    throw "asset.ts structure check failed: getHoldings not found"
}

if ($asset -notmatch '\.from\("holdings"\)') {
    throw "asset.ts structure check failed: holdings query not found"
}

Write-Host "[OK] Source structure looks correct"
Write-Host ""

# ============================================================
# Backup local files
# ============================================================

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

$BackupPage = "$PagePath.backup-$Timestamp"
$BackupAsset = "$AssetPath.backup-$Timestamp"

Write-Host "[4] Creating local backups..."

Copy-Item $PagePath $BackupPage -Force
Copy-Item $AssetPath $BackupAsset -Force

Write-Host "[OK] Backup:"
Write-Host $BackupPage
Write-Host $BackupAsset
Write-Host ""

# ============================================================
# Modify asset.ts
# ============================================================

Write-Host "[5] Modifying asset.ts..."

# ------------------------------------------------------------
# Add native fields to Holding type
# ------------------------------------------------------------

if ($asset -notmatch "native_currency\?:") {

    $assetNativeFields = @"
  native_currency?: string | null;
  native_cost?: number | null;
  native_amount?: number | null;
"@

    $assetHoldingMarker = "  [key: string]: any;"

    if (!$asset.Contains($assetHoldingMarker)) {
        throw "asset.ts: Holding insertion point not found"
    }

    $asset = $asset.Replace(
        $assetHoldingMarker,
        $assetNativeFields + "`r`n" + $assetHoldingMarker
    )

    Write-Host "[OK] Added native fields to Holding"
}
else {
    Write-Host "[SKIP] Native fields already exist in asset.ts"
}

# ------------------------------------------------------------
# Replace getHoldings()
# ------------------------------------------------------------

if ($asset -notmatch "holding_native_currency") {

    $getHoldingsPattern = '(?s)export async function getHoldings\(\): Promise<Holding\[\]> \{.*?\n\}'

    $getHoldingsReplacement = @'
export async function getHoldings(): Promise<Holding[]> {
  const [
    holdingsResult,
    nativeResult,
  ] = await Promise.all([
    supabase
      .from("holdings")
      .select("*")
      .eq(
        "active",
        true
      )
      .order(
        "amount",
        {
          ascending: false,
        }
      ),

    supabase
      .from("holding_native_currency")
      .select(
        "holding_id, native_currency, native_cost, native_amount"
      ),
  ]);

  if (holdingsResult.error) {
    console.error(
      "getHoldings error:",
      holdingsResult.error
    );
    return [];
  }

  if (nativeResult.error) {
    console.error(
      "getHoldingNativeCurrencies error:",
      nativeResult.error
    );
  }

  const nativeMap = new Map<
    number,
    {
      native_currency: string;
      native_cost: number;
      native_amount: number;
    }
  >();

  for (const item of nativeResult.data ?? []) {
    nativeMap.set(Number(item.holding_id), {
      native_currency:
        item.native_currency,
      native_cost:
        Number(item.native_cost) || 0,
      native_amount:
        Number(item.native_amount) || 0,
    });
  }

  return (holdingsResult.data ?? []).map(
    holding => {
      const native =
        nativeMap.get(Number(holding.id));

      return {
        ...holding,
        native_currency:
          native?.native_currency ?? null,
        native_cost:
          native?.native_cost ?? null,
        native_amount:
          native?.native_amount ?? null,
      };
    }
  );
}
'@

    $assetMatches = [regex]::Matches(
        $asset,
        $getHoldingsPattern
    )

    if ($assetMatches.Count -ne 1) {
        throw "asset.ts: Expected exactly one getHoldings() function, found $($assetMatches.Count)"
    }

    $asset = [regex]::Replace(
        $asset,
        $getHoldingsPattern,
        $getHoldingsReplacement,
        1
    )

    Write-Host "[OK] Replaced getHoldings()"
}
else {
    Write-Host "[SKIP] asset.ts already contains holding_native_currency"
}

# ============================================================
# Modify page.tsx
# ============================================================

Write-Host ""
Write-Host "[6] Modifying page.tsx..."

# ------------------------------------------------------------
# Holding type
# ------------------------------------------------------------

if ($page -notmatch "native_currency\?: string \| null") {

    $pageHoldingPattern = '(?s)(type Holding = \{.*?skip_update: boolean;)'

    $pageHoldingMatch = [regex]::Match(
        $page,
        $pageHoldingPattern
    )

    if (!$pageHoldingMatch.Success) {
        throw "page.tsx: Holding type not found"
    }

    $pageHoldingReplacement = $pageHoldingMatch.Groups[1].Value + @"

  native_currency?: string | null;
  native_cost?: number | null;
  native_amount?: number | null;
"@

    $page = $page.Replace(
        $pageHoldingMatch.Groups[1].Value,
        $pageHoldingReplacement
    )

    Write-Host "[OK] Added native fields to page.tsx Holding"
}
else {
    Write-Host "[SKIP] page.tsx native fields already exist"
}

# ------------------------------------------------------------
# Replace loadHoldings()
# ------------------------------------------------------------

if ($page -notmatch "holding_native_currency") {

    $loadPattern = '(?s)async function loadHoldings\(\) \{.*?\n\}'

    $loadReplacement = @'
async function loadHoldings() {
  setLoading(true);
  setError("");

  const [
    holdingsResult,
    nativeResult,
  ] = await Promise.all([
    supabase
      .from("holdings")
      .select("*")
      .order("active", {
        ascending: false,
      })
      .order("amount", {
        ascending: false,
        nullsFirst: false,
      }),

    supabase
      .from("holding_native_currency")
      .select(
        "holding_id, native_currency, native_cost, native_amount"
      ),
  ]);

  if (holdingsResult.error) {
    console.error(
      "load holdings error:",
      holdingsResult.error
    );
    setError(
      `读取资产失败：${holdingsResult.error.message}`
    );
    setHoldings([]);
    setLoading(false);
    return;
  }

  if (nativeResult.error) {
    console.error(
      "load holding native currency error:",
      nativeResult.error
    );
  }

  const nativeMap = new Map<
    number,
    {
      native_currency: string | null;
      native_cost: number | null;
      native_amount: number | null;
    }
  >();

  for (const row of nativeResult.data ?? []) {
    nativeMap.set(Number(row.holding_id), {
      native_currency:
        row.native_currency ?? null,
      native_cost:
        row.native_cost == null
          ? null
          : Number(row.native_cost),
      native_amount:
        row.native_amount == null
          ? null
          : Number(row.native_amount),
    });
  }

  const merged = (holdingsResult.data ?? []).map(
    holding => {
      const native =
        nativeMap.get(Number(holding.id));

      return {
        ...holding,
        native_currency:
          native?.native_currency ?? null,
        native_cost:
          native?.native_cost ?? null,
        native_amount:
          native?.native_amount ?? null,
      };
    }
  ) as Holding[];

  setHoldings(merged);
  setLoading(false);
}
'@

    $loadMatches = [regex]::Matches(
        $page,
        $loadPattern
    )

    if ($loadMatches.Count -ne 1) {
        throw "page.tsx: Expected exactly one loadHoldings(), found $($loadMatches.Count)"
    }

    $page = [regex]::Replace(
        $page,
        $loadPattern,
        $loadReplacement,
        1
    )

    Write-Host "[OK] Replaced loadHoldings()"
}
else {
    Write-Host "[SKIP] page.tsx already contains holding_native_currency"
}

# ------------------------------------------------------------
# Add showNative to Hong Kong table
# ------------------------------------------------------------

if ($page -notmatch 'title="香港资产"[\s\S]{0,2000}showNative') {

    $hkTitleIndex = $page.IndexOf('title="香港资产"')

    if ($hkTitleIndex -lt 0) {
        throw "page.tsx: Hong Kong table not found"
    }

    $hkEndIndex = $page.IndexOf("/>", $hkTitleIndex)

    if ($hkEndIndex -lt 0) {
        throw "page.tsx: Hong Kong table ending not found"
    }

    $hkBlock = $page.Substring(
        $hkTitleIndex,
        $hkEndIndex - $hkTitleIndex + 2
    )

    if ($hkBlock -notmatch 'emptyText="暂无香港资产"') {
        throw "page.tsx: Hong Kong table structure changed"
    }

    $hkBlockNew = $hkBlock.Replace(
        'emptyText="暂无香港资产"',
        'emptyText="暂无香港资产"' + "`r`n" + '  showNative'
    )

    $page =
        $page.Substring(0, $hkTitleIndex) +
        $hkBlockNew +
        $page.Substring($hkEndIndex + 2)

    Write-Host "[OK] Added showNative to Hong Kong table"
}
else {
    Write-Host "[SKIP] Hong Kong table already has showNative"
}

# ------------------------------------------------------------
# AssetRegionTable props
# ------------------------------------------------------------

if ($page -notmatch "showNative\?: boolean;") {

    $propsMarker = "  emptyText: string;"

    if (!$page.Contains($propsMarker)) {
        throw "page.tsx: AssetRegionTable props not found"
    }

    $page = $page.Replace(
        $propsMarker,
        $propsMarker + "`r`n  showNative?: boolean;"
    )

    Write-Host "[OK] Added showNative prop"
}
else {
    Write-Host "[SKIP] showNative prop already exists"
}

# ------------------------------------------------------------
# AssetRegionTable destructuring
# ------------------------------------------------------------

if ($page -notmatch "updatingSkipId,\s*emptyText,\s*showNative") {

    $destructureMarker = @'
  updatingSkipId,
  emptyText,
}: {
'@

    if (!$page.Contains($destructureMarker)) {
        throw "page.tsx: AssetRegionTable destructuring not found"
    }

    $destructureReplacement = @'
  updatingSkipId,
  emptyText,
  showNative,
}: {
'@

    $page = $page.Replace(
        $destructureMarker,
        $destructureReplacement
    )

    Write-Host "[OK] Added showNative destructuring"
}
else {
    Write-Host "[SKIP] showNative destructuring already exists"
}

# ------------------------------------------------------------
# Table width
# ------------------------------------------------------------

if ($page -notmatch 'min-w-\[1700px\]') {

    $oldWidth = @'
<table
  className="
    min-w-[1450px]
    w-full
    text-sm
  "
>
'@

    $newWidth = @'
<table
  className={`
    w-full
    text-sm
    ${showNative ? "min-w-[1700px]" : "min-w-[1450px]"}
  `}
>
'@

    if (!$page.Contains($oldWidth)) {
        throw "page.tsx: Original table width block not found"
    }

    $page = $page.Replace(
        $oldWidth,
        $newWidth
    )

    Write-Host "[OK] Updated table width"
}
else {
    Write-Host "[SKIP] Table width already updated"
}

# ============================================================
# Rename Amount / Cost headers
# ============================================================

Write-Host ""
Write-Host "[7] Updating Chinese headers..."

# Replace only table header labels.
# If already Chinese, skip.

$page = $page.Replace(
    ">Amount</th>",
    ">金额（CNY）</th>"
)

$page = $page.Replace(
    ">Cost</th>",
    ">成本（CNY）</th>"
)

$page = $page.Replace(
    "Amount</th>",
    "金额（CNY）</th>"
)

$page = $page.Replace(
    "Cost</th>",
    "成本（CNY）</th>"
)

Write-Host "[OK] Amount / Cost headers updated"

# ============================================================
# Add native headers
# ============================================================

if ($page -notmatch "本币成本（USD）") {

    $costHeaderPattern = @'
(?s)(<th
\s+className="
\s+px-4
\s+py-3
\s+text-right
\s+font-medium
\s+"
>
\s*成本（CNY）
\s*</th>)
'@

    $nativeHeaders = @'

{showNative && (
  <>
    <th className="px-4 py-3 text-right font-medium">
      本币成本（USD）
    </th>

    <th className="px-4 py-3 text-right font-medium">
      本币金额（USD）
    </th>
  </>
)}
'@

    $costHeaderMatch = [regex]::Match(
        $page,
        $costHeaderPattern
    )

    if (!$costHeaderMatch.Success) {

        # Try a simpler fallback
        $simpleCostHeader = @'
<th
  className="
    px-4
    py-3
    text-right
    font-medium
  "
>
  成本（CNY）
</th>
'@

        if (!$page.Contains($simpleCostHeader)) {
            throw "page.tsx: Cost header not found"
        }

        $page = $page.Replace(
            $simpleCostHeader,
            $simpleCostHeader + $nativeHeaders
        )
    }
    else {
        $page = $page.Replace(
            $costHeaderMatch.Groups[1].Value,
            $costHeaderMatch.Groups[1].Value + $nativeHeaders
        )
    }

    Write-Host "[OK] Added native headers"
}
else {
    Write-Host "[SKIP] Native headers already exist"
}

# ============================================================
# Add native cells
# ============================================================

if ($page -notmatch "item\.native_cost") {

    $costCell = @'
<td
  className="
    px-4
    py-4
    text-right
    tabular-nums
    text-gray-600
  "
>
  ¥{formatMoney(item.cost)}
</td>
'@

    $nativeCells = @'

{showNative && (
  <>
    <td
      className="
        px-4
        py-4
        text-right
        tabular-nums
        text-gray-600
      "
    >
      {item.native_cost != null
        ? `USD ${formatMoney(item.native_cost)}`
        : "—"}
    </td>

    <td
      className="
        px-4
        py-4
        text-right
        font-medium
        tabular-nums
        text-gray-900
      "
    >
      {item.native_amount != null
        ? `USD ${formatMoney(item.native_amount)}`
        : "—"}
    </td>
  </>
)}
'@

    if (!$page.Contains($costCell)) {
        throw "page.tsx: Cost data cell not found"
    }

    $page = $page.Replace(
        $costCell,
        $costCell + $nativeCells
    )

    Write-Host "[OK] Added native data cells"
}
else {
    Write-Host "[SKIP] Native data cells already exist"
}

# ============================================================
# Final checks
# ============================================================

Write-Host ""
Write-Host "[8] Running final checks..."

$requiredPageStrings = @(
    "native_currency",
    "native_cost",
    "native_amount",
    "holding_native_currency",
    "showNative",
    "本币成本（USD）",
    "本币金额（USD）",
    "金额（CNY）",
    "成本（CNY）"
)

foreach ($text in $requiredPageStrings) {

    if (!$page.Contains($text)) {
        throw "FINAL CHECK FAILED in page.tsx: $text"
    }

    Write-Host "[OK] page.tsx contains: $text"
}

$requiredAssetStrings = @(
    "native_currency",
    "native_cost",
    "native_amount",
    "holding_native_currency"
)

foreach ($text in $requiredAssetStrings) {

    if (!$asset.Contains($text)) {
        throw "FINAL CHECK FAILED in asset.ts: $text"
    }

    Write-Host "[OK] asset.ts contains: $text"
}

# ============================================================
# IMPORTANT:
# Make sure we never added CNY conversion logic.
# ============================================================

if ($page -match "usdCnyRate") {
    throw "Unexpected usdCnyRate found in page.tsx"
}

Write-Host "[OK] No USD/CNY conversion logic added"

# ============================================================
# Write files
# ============================================================

Write-Host ""
Write-Host "[9] Writing modified files..."

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

[System.IO.File]::WriteAllText(
    $PagePath,
    $page,
    $Utf8NoBom
)

[System.IO.File]::WriteAllText(
    $AssetPath,
    $asset,
    $Utf8NoBom
)

Write-Host "[OK] page.tsx written"
Write-Host "[OK] asset.ts written"

# ============================================================
# Done
# ============================================================

Write-Host ""
Write-Host "============================================================"
Write-Host " SUCCESS"
Write-Host "============================================================"
Write-Host ""

Write-Host "Modified:"
Write-Host "  app\asset-management\page.tsx"
Write-Host "  lib\asset.ts"
Write-Host ""

Write-Host "Hong Kong table:"
Write-Host "  Amount      -> 金额（CNY）"
Write-Host "  Cost        -> 成本（CNY）"
Write-Host "  Native Cost -> 本币成本（USD）"
Write-Host "  Native Amount -> 本币金额（USD）"
Write-Host ""

Write-Host "Native values remain in USD."
Write-Host "No USD to CNY conversion was added."
Write-Host ""

Write-Host "Backups:"
Write-Host "  $BackupPage"
Write-Host "  $BackupAsset"
Write-Host ""

Write-Host "Next:"
Write-Host "  npm run dev"
Write-Host ""