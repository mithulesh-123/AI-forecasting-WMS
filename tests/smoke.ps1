# End-to-end smoke test against a running production server.
# Usage: powershell -File tests\smoke.ps1 -BaseUrl http://localhost:3000
param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Password = "Password123!"
)

$ErrorActionPreference = "Stop"
$pass = 0; $fail = 0

function Check($name, $condition, $detail = "") {
  if ($condition) { $script:pass++; Write-Host "  PASS $name" }
  else { $script:fail++; Write-Host "  FAIL $name $detail" -ForegroundColor Red }
}

# --- HttpClient plumbing: reliable status codes + bodies across PS versions ---
Add-Type -AssemblyName System.Net.Http

function NewSession {
  # Manual cookie handling: .NET Framework's CookieContainer rejects SameSite attrs.
  $h = New-Object System.Net.Http.HttpClientHandler
  $h.AllowAutoRedirect = $false
  $h.UseCookies = $false
  return @{ client = New-Object System.Net.Http.HttpClient($h); cookies = @{} }
}

function CaptureSetCookie($sess, $resp) {
  $values = $null
  if ($resp.Headers.TryGetValues("Set-Cookie", [ref]$values)) {
    foreach ($sc in $values) {
      $parts = $sc -split ";"
      $pair = $parts[0]
      $name = ($pair -split "=", 2)[0].Trim()
      $value = ($pair -split "=", 2)[1]
      if ($value -eq "") { $sess.cookies.Remove($name) | Out-Null }
      else { $sess.cookies[$name] = $value.Trim() }
    }
  }
}

function Req($method, $url, $sess, $bodyObj = $null) {
  $msg = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::new($method), $url)
  if ($null -ne $bodyObj) {
    $msg.Content = New-Object System.Net.Http.StringContent(($bodyObj | ConvertTo-Json -Depth 6), [Text.Encoding]::UTF8, "application/json")
  }
  if ($sess.cookies.Count -gt 0) {
    $cookieHeader = ($sess.cookies.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "; "
    $msg.Headers.TryAddWithoutValidation("Cookie", $cookieHeader) | Out-Null
  }
  $resp = $sess.client.SendAsync($msg).GetAwaiter().GetResult()
  CaptureSetCookie $sess $resp
  $raw = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  $json = $null
  try { $json = $raw | ConvertFrom-Json } catch {}
  return @{ status = [int]$resp.StatusCode; json = $json; raw = $raw }
}

function PageReq($url, $sess) {
  # GET returning @{status; raw} without throwing, redirects NOT followed
  $msg = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::new("GET"), $url)
  if ($sess.cookies.Count -gt 0) {
    $cookieHeader = ($sess.cookies.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "; "
    $msg.Headers.TryAddWithoutValidation("Cookie", $cookieHeader) | Out-Null
  }
  $resp = $sess.client.SendAsync($msg).GetAwaiter().GetResult()
  CaptureSetCookie $sess $resp
  $raw = ""
  try { $raw = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult() } catch {}
  return @{ status = [int]$resp.StatusCode; raw = $raw; location = if ($resp.Headers.Location) { $resp.Headers.Location.ToString() } else { "" } }
}

function LoginSession($email) {
  $s = NewSession
  $r = Req "POST" "$BaseUrl/api/auth/login" $s @{ email = $email; password = $Password }
  if ($r.status -ne 200) { throw "login failed for $email ($($r.raw))" }
  return $s
}

Write-Host "== Authentication =="
$r = Req "POST" "$BaseUrl/api/auth/login" (NewSession) @{ email = "admin@nexuswms.io"; password = "wrong" }
Check "login rejects bad password" ($r.status -eq 401)

$session = LoginSession "admin@nexuswms.io"
Check "admin login + session cookie" ($session.cookies.ContainsKey("wms_session"))
$me = Req "GET" "$BaseUrl/api/auth/me" $session
Check "/api/auth/me" ($me.json.data.email -eq "admin@nexuswms.io")

Write-Host "== Pages render (server components) =="
foreach ($path in @("/dashboard","/products","/warehouses","/inventory","/stock-movements","/dispatch","/forecast","/reports","/users","/audit-logs","/settings")) {
  $r = PageReq "$BaseUrl$path" $session
  Check "GET $path -> $($r.status)" ($r.status -eq 200)
}

Write-Host "== Unauthenticated access blocked =="
$anon = NewSession
$r = PageReq "$BaseUrl/dashboard" $anon
Check "anonymous /dashboard redirected to login" ($r.status -in 302,307 -and $r.location -match "/login")
$r = Req "GET" "$BaseUrl/api/products" (NewSession)
Check "anonymous API returns 401" ($r.status -eq 401)

Write-Host "== Products API =="
$products = Req "GET" "$BaseUrl/api/products?perPage=5&q=wireless" $session
Check "product search works" ($products.json.data.total -ge 1)
$anyProduct = (Req "GET" "$BaseUrl/api/products?perPage=1&sort=name&order=asc" $session).json.data.items[0]
$warehouses = (Req "GET" "$BaseUrl/api/warehouses?perPage=1&sort=name&order=asc" $session).json.data.items[0]

Write-Host "== Inventory operations =="
function StockOp($type, $qty, $dest = $null) {
  Req "POST" "$BaseUrl/api/inventory" $session @{
    type = $type; productId = $anyProduct.id; warehouseId = $warehouses.id
    destinationWarehouseId = $dest; quantity = $qty; reason = "smoke test"
  }
}
$invBefore = (Req "GET" "$BaseUrl/api/inventory?q=$($anyProduct.sku)&warehouseId=$($warehouses.id)" $session).json.data.items[0]
if ($null -eq $invBefore) {
  StockOp "IN" 500 | Out-Null
  $invBefore = (Req "GET" "$BaseUrl/api/inventory?q=$($anyProduct.sku)&warehouseId=$($warehouses.id)" $session).json.data.items[0]
}
StockOp "IN" 500 | Out-Null
$invAfterIn = (Req "GET" "$BaseUrl/api/inventory?q=$($anyProduct.sku)&warehouseId=$($warehouses.id)" $session).json.data.items[0]
Check "Stock IN recorded (+500)" ($invAfterIn.quantity -eq $invBefore.quantity + 500) "got $($invAfterIn.quantity) expected $($invBefore.quantity + 500)"

$r = StockOp "OUT" ($invAfterIn.availableQuantity + 1000)
Check "oversell rejected INSUFFICIENT_STOCK" ($r.status -eq 422 -and $r.json.error.code -eq "INSUFFICIENT_STOCK") "status=$($r.status) body=$($r.raw)"
StockOp "OUT" 50 | Out-Null
StockOp "ADJUSTMENT" ($invAfterIn.quantity - 50 + 10) | Out-Null

Write-Host "== Dispatch lifecycle =="
$qtyAtStart = (Req "GET" "$BaseUrl/api/inventory?q=$($anyProduct.sku)&warehouseId=$($warehouses.id)" $session).json.data.items[0]
$r = Req "POST" "$BaseUrl/api/dispatch" $session @{
  customerName = "Smoke Test Customer"; warehouseId = $warehouses.id
  items = @(@{ productId = $anyProduct.id; quantity = 25 })
}
$dsp = $r.json.data
Check "dispatch created $($dsp.number)" ($r.status -eq 201 -and $dsp.status -eq "PENDING")

$reserved = (Req "GET" "$BaseUrl/api/inventory?q=$($anyProduct.sku)&warehouseId=$($warehouses.id)" $session).json.data.items[0]
Check "stock reserved (+25)" ($reserved.reservedQuantity -eq $qtyAtStart.reservedQuantity + 25)

$r = Req "POST" "$BaseUrl/api/dispatch" $session @{
  customerName = "Overdraw Inc"; warehouseId = $warehouses.id
  items = @(@{ productId = $anyProduct.id; quantity = 99999 })
}
Check "dispatch overdraw rejected INSUFFICIENT_STOCK" ($r.json.error.code -eq "INSUFFICIENT_STOCK")

foreach ($status in @("PROCESSING","READY","DISPATCHED")) {
  $u = Req "POST" "$BaseUrl/api/dispatch/$($dsp.id)/status" $session @{ status = $status }
  Check "transition -> $status" ($u.json.data.status -eq $status)
}
$afterDispatch = (Req "GET" "$BaseUrl/api/inventory?q=$($anyProduct.sku)&warehouseId=$($warehouses.id)" $session).json.data.items[0]
Check "completion deducted qty (-25), reservation released" (
  $afterDispatch.quantity -eq $qtyAtStart.quantity - 25 -and
  $afterDispatch.reservedQuantity -eq $qtyAtStart.reservedQuantity )

$mvts = Req "GET" "$BaseUrl/api/stock-movement?q=$($dsp.number)" $session
Check "immutable OUT movement references dispatch number" ($mvts.json.data.total -ge 1)

$r = Req "POST" "$BaseUrl/api/dispatch/$($dsp.id)/status" $session @{ status = "CANCELLED" }
Check "DISPATCHED is terminal (INVALID_TRANSITION)" ($r.json.error.code -eq "INVALID_TRANSITION")

# Cancellation releases reservations
$r = Req "POST" "$BaseUrl/api/dispatch" $session @{
  customerName = "Cancel Me"; warehouseId = $warehouses.id
  items = @(@{ productId = $anyProduct.id; quantity = 5 })
}
$cDsp = $r.json.data
$reqBeforeCancel = (Req "GET" "$BaseUrl/api/inventory?q=$($anyProduct.sku)&warehouseId=$($warehouses.id)" $session).json.data.items[0].reservedQuantity
Req "POST" "$BaseUrl/api/dispatch/$($cDsp.id)/status" $session @{ status = "CANCELLED" } | Out-Null
$reqAfterCancel = (Req "GET" "$BaseUrl/api/inventory?q=$($anyProduct.sku)&warehouseId=$($warehouses.id)" $session).json.data.items[0].reservedQuantity
Check "cancellation releases reservation (-5)" ($reqAfterCancel -eq $reqBeforeCancel - 5)

Write-Host "== AI forecasting =="
$fc = Req "GET" "$BaseUrl/api/forecasting?productId=$($anyProduct.id)&horizon=14" $session
Check "forecast generated (14 predictions)" ($fc.json.data.predictions.Count -eq 14)
Check "confidence bounded 35..96" ($fc.json.data.confidence -ge 35 -and $fc.json.data.confidence -le 96)
Check "stockout risk classified" (@("LOW","MEDIUM","HIGH","CRITICAL") -contains $fc.json.data.stockoutRisk)
Check "reorder recommendation present (int >= 0)" ($fc.json.data.recommendedReorderQty -is [long] -or $fc.json.data.recommendedReorderQty -is [int])
$fcRun = Req "POST" "$BaseUrl/api/forecasting" $session @{ productId = $anyProduct.id; horizon = 30; persist = $true }
Check "forecast persisted via POST" ($fcRun.status -eq 200 -and $fcRun.json.data.horizonDays -eq 30) "status=$($fcRun.status) body=$($fcRun.raw.Substring(0, [Math]::Min(200, $fcRun.raw.Length)))"

Write-Host "== Reports CSV =="
foreach ($t in @("inventory","stock-movement","dispatch","forecast")) {
  $r = Req "GET" "$BaseUrl/api/reports/$t" $session
  Check "CSV export $t ($([math]::Round($r.raw.Length/1kb,1))kb)" ($r.status -eq 200 -and $r.raw.Length -gt 50)
}

Write-Host "== Audit trail =="
$audit = Req "GET" "$BaseUrl/api/audit-logs?action=LOGIN&perPage=3" $session
Check "LOGIN audited" ($audit.json.data.total -ge 1)
$auditDsp = Req "GET" "$BaseUrl/api/audit-logs?action=DISPATCH_DISPATCHED&perPage=3" $session
Check "DISPATCH_DISPATCHED audited" ($auditDsp.json.data.total -ge 1)
$notif = Req "GET" "$BaseUrl/api/notifications" $session
Check "notifications endpoint" ($notif.status -eq 200)

Write-Host "== RBAC enforcement (server-side) =="
$viewer = LoginSession "viewer@nexuswms.io"
$r = Req "POST" "$BaseUrl/api/products" $viewer @{ sku = "HACK-1"; name = "x"; category = "y"; price = 1; reorderLevel = 1; reorderQuantity = 1 }
Check "VIEWER cannot create products (403 FORBIDDEN)" ($r.status -eq 403 -and $r.json.error.code -eq "FORBIDDEN")
$r = Req "GET" "$BaseUrl/api/products?perPage=1" $viewer
Check "VIEWER can read products" ($r.status -eq 200)
$r = Req "GET" "$BaseUrl/api/users?perPage=1" $viewer
Check "VIEWER cannot list users (403)" ($r.status -eq 403)

$staff = LoginSession "staff@nexuswms.io"
$r = Req "GET" "$BaseUrl/api/users?perPage=1" $staff
Check "STAFF cannot read users (403)" ($r.status -eq 403)
$r = Req "GET" "$BaseUrl/api/reports/inventory" $staff
Check "STAFF cannot export reports (403)" ($r.status -eq 403)
$r = Req "POST" "$BaseUrl/api/inventory" $staff @{
  type = "IN"; productId = $anyProduct.id; warehouseId = $warehouses.id; quantity = 3; reason = "staff op"
}
Check "STAFF can record stock operations" ($r.status -eq 201)

$manager = LoginSession "manager@nexuswms.io"
$r = Req "POST" "$BaseUrl/api/products" $manager @{
  sku = "MGR-TEST-1"; name = "Manager Test Product"; category = "Testing"; unit = "pcs"; price = 12.34; reorderLevel = 5; reorderQuantity = 20
}
Check "MANAGER can create products" ($r.status -eq 201)
$mgrProductId = $r.json.data.id
$r = Req "DELETE" "$BaseUrl/api/products/$mgrProductId" $manager
Check "MANAGER can delete products" ($r.status -eq 200)

Write-Host ""
Write-Host "RESULT: $pass passed, $fail failed"
if ($fail -gt 0) { exit 1 }
