$dir = 'D:\Missonce\Missonce\WeChat Mini'
$issues = @()

# 1. Check ad-unit.js braces
$adjs = Get-Content "$dir\components\ad-unit\ad-unit.js" -Raw
$open = ($adjs -split '\{' | Measure-Object).Count - 1
$close = ($adjs -split '\}' | Measure-Object).Count - 1
$issues += if ($open -eq $close) { "ad-unit.js: braces balanced OK ($open/$close)" } else { "ad-unit.js: BRACES UNBALANCED ($open/$close)!" }

# 2. ad-unit.js show/hide - must use setData now
if ($adjs -match 'show\(\)[\s\S]{0,200}setData.*_pageHidden.*false') {
  $issues += "ad-unit.js show(): uses setData for _pageHidden - OK"
} else {
  $issues += "ad-unit.js show(): MISSING setData for _pageHidden!"
}
if ($adjs -match 'hide\(\)[\s\S]{0,200}setData.*_pageHidden.*true') {
  $issues += "ad-unit.js hide(): uses setData for _pageHidden - OK"
} else {
  $issues += "ad-unit.js hide(): MISSING setData for _pageHidden!"
}

# 3. ad-unit.js detached - must NOT use setData
if ($adjs -match 'detached\(\)[\s\S]{0,500}this\.setData') {
  $issues += "ad-unit.js detached(): CRITICAL - contains setData!"
} else {
  $issues += "ad-unit.js detached(): no setData - OK"
}

# 4. ad-unit.js IntersectionObserver nativeMode
if ($adjs -match 'createIntersectionObserver.*nativeMode.*true') {
  $issues += "ad-unit.js: IntersectionObserver nativeMode=true - OK"
} else {
  $issues += "ad-unit.js: IntersectionObserver missing nativeMode!"
}

# 5. Check all files for IntersectionObserver without nativeMode
$iObsFiles = @(
  "$dir/pages/avatar/avatar.js",
  "$dir/pages/wallpaper/wallpaper.js"
)
foreach ($f in $iObsFiles) {
  $name = (Split-Path $f -Leaf)
  $c = Get-Content $f -Raw
  if ($c -match 'createIntersectionObserver') {
    if ($c -match 'nativeMode.*true') {
      $issues += "${name}: IntersectionObserver nativeMode=true - OK"
    } else {
      $issues += "${name}: WARNING - IntersectionObserver missing nativeMode"
    }
  }
}

# 6. Check preview.js and wallpaper-preview.js onUnload for setData
$preview = Get-Content "$dir/subpackages/preview/preview.js" -Raw
$wpPreview = Get-Content "$dir/subpackages/wallpaper-preview/wallpaper-preview.js" -Raw

if ($preview -match 'onUnload[\s\S]{0,60}this\.setData') {
  $issues += "preview.js: CRITICAL - onUnload still calls setData!"
} else {
  $issues += "preview.js: onUnload no setData - OK"
}
if ($wpPreview -match 'onUnload[\s\S]{0,60}this\.setData') {
  $issues += "wallpaper-preview.js: CRITICAL - onUnload still calls setData!"
} else {
  $issues += "wallpaper-preview.js: onUnload no setData - OK"
}

# 7. Brace balance for preview files
foreach ($f in @("$dir/subpackages/preview/preview.js", "$dir/subpackages/wallpaper-preview/wallpaper-preview.js")) {
  $name = (Split-Path $f -Leaf)
  $c = Get-Content $f -Raw
  $open = ($c -split '\{' | Measure-Object).Count - 1
  $closeB = ($c -split '\}' | Measure-Object).Count - 1
  $issues += if ($open -eq $closeB) { "${name}: braces balanced OK ($open/$closeB)" } else { "${name}: BRACES UNBALANCED ($open/$closeB)!" }
}

# 8. Check WXML structure
$wxml = Get-Content "$dir/components/ad-unit/ad-unit.wxml" -Raw
if ($wxml -match 'wx:elif="{{kind === .rewarded.}}"') {
  $issues += "ad-unit.wxml: rewarded elif found - OK"
} else {
  $issues += "ad-unit.wxml: WARNING - rewarded elif missing"
}
if ($wxml -match 'wx:elif="{{kind === .interstitial.}}"') {
  $issues += "ad-unit.wxml: interstitial elif found - OK"
} else {
  $issues += "ad-unit.wxml: WARNING - interstitial elif missing"
}
if ($wxml -match 'wx:if="{{!_pageHidden}}"') {
  $issues += "ad-unit.wxml: root wx:if found - OK (will unload native ads on hide)"
}

# 9. Check index.wxml quick-grid indentation
$index = Get-Content "$dir/pages/index/index.wxml"
$gridFound = $false
foreach ($line in $index) {
  if ($line -match 'quick-grid') { $gridFound = $true; continue }
}
$issues += if ($gridFound) { "index.wxml: quick-grid section found - OK" } else { "index.wxml: quick-grid section MISSING!" }

Write-Host "=== Code Review Results ==="
$issues | ForEach-Object { Write-Host $_ }