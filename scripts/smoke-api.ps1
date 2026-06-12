$port = if ($env:PORT) { $env:PORT } else { '4000' }
$baseUrl = "http://localhost:$port"
$ErrorActionPreference = 'Stop'
$dataDir = (Resolve-Path 'backend/src/data').Path
$backupRoot = Join-Path ([System.IO.Path]::GetTempPath()) "admin-dashboard-smoke-$([guid]::NewGuid())"
$backupDataDir = Join-Path $backupRoot 'data'
New-Item -ItemType Directory -Path $backupDataDir -Force | Out-Null
Get-ChildItem -Path $dataDir -Filter '*.json' -File | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $backupDataDir -Force
}

$p = Start-Process -FilePath node -ArgumentList 'backend/src/server.mjs' -PassThru
Start-Sleep -Seconds 2

try {
  $loginBody = @{ email = 'admin@client.com'; password = 'Admin@12345' } | ConvertTo-Json
  $login = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType 'application/json' -Body $loginBody
  $headers = @{ Authorization = "Bearer $($login.data.token)" }

  function Invoke-Api {
    param(
      [string]$Method,
      [string]$Path,
      [object]$Body = $null
    )
    $params = @{
      Method = $Method
      Uri = "$baseUrl$Path"
      Headers = $headers
      ContentType = 'application/json'
    }
    if ($null -ne $Body) {
      $params.Body = ($Body | ConvertTo-Json -Depth 12)
    }
    Invoke-RestMethod @params
  }

  function Assert-True {
    param(
      [bool]$Condition,
      [string]$Message
    )
    if (-not $Condition) {
      throw $Message
    }
  }

  $health = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/health"
  $me = Invoke-Api Get '/api/auth/me'
  $orders = Invoke-Api Get '/api/orders'
  $products = Invoke-Api Get '/api/products'
  $customers = Invoke-Api Get '/api/customers'
  $stockMovements = Invoke-Api Get '/api/stock/movements'
  $stockAlerts = Invoke-Api Get '/api/stock/alerts'
  $deliveries = Invoke-Api Get '/api/deliveries'
  $deliveryReport = Invoke-Api Get '/api/deliveries/report/daily'
  $invoices = Invoke-Api Get '/api/invoices'
  $deliveryNotes = Invoke-Api Get '/api/delivery-notes'
  $accounting = Invoke-Api Get '/api/accounting/summary'
  $accountingDashboard = Invoke-Api Get '/api/accounting/dashboard'
  $accountingCsv = Invoke-Api Get '/api/accounting/export.csv'
  $ads = Invoke-Api Get '/api/ads/campaigns'
  $marketing = Invoke-Api Get '/api/marketing/campaigns'
  $templates = Invoke-Api Get '/api/marketing/templates'
  $analytics = Invoke-Api Get '/api/analytics/overview'
  $integrations = Invoke-Api Get '/api/integrations/settings'
  $integrationHealth = Invoke-Api Get '/api/integrations/health'
  $channels = Invoke-Api Get '/api/sales-channels'
  $syncJobs = Invoke-Api Get '/api/sync-jobs'
  $search = Invoke-Api Get '/api/search?q=mac'
  $notifications = Invoke-Api Get '/api/notifications'
  $agentChannels = Invoke-Api Get '/api/agents/channels'
  $agentConversations = Invoke-Api Get '/api/agents/conversations'
  $agentSettings = Invoke-Api Get '/api/agents/settings'
  $agentRules = Invoke-Api Get '/api/agents/rules'
  $copilot = Invoke-Api Post '/api/copilot/analyze' @{ role = 'Executive'; datePreset = '30d'; question = 'Smoke check summary' }
  $advancedCopilot = Invoke-Api Post '/api/copilot/advanced/analyze' @{ role = 'Executive'; datePreset = '30d'; question = 'Smoke check summary' }
  $assistant = Invoke-Api Post '/api/agents/dashboard-assistant' @{ message = 'Give me a short health summary'; history = @(); mode = 'assistant' }
  $socialAnalysis = Invoke-Api Post '/api/agents/social-analyze' @{ message = 'Prix et livraison?'; language = 'fr' }
  $socialReply = Invoke-Api Post '/api/agents/social-reply' @{ message = 'Prix et livraison?'; channel = 'whatsapp'; contact = 'Smoke Test' }
  $orderExtraction = Invoke-Api Post '/api/agents/extract-order' @{ conversation_history = 'Client: Je veux commander un produit. Tel 20000000. Adresse Tunis.' }
  $marketingCopy = Invoke-Api Post '/api/marketing/generate-copy' @{ product = 'smoke product'; audience = 'VIP customers' }
  $adCopy = Invoke-Api Post '/api/ads/generate-copy' @{ product = 'smoke product'; audience = 'new shoppers' }

  Assert-True ($health.data.ok -eq $true) 'Health endpoint failed'
  Assert-True ($me.data.user.email -eq 'admin@client.com') 'Auth /me returned wrong user'
  Assert-True ($accountingCsv.data.contentType -eq 'text/csv') 'Accounting CSV export failed'
  Assert-True ($copilot.data.answer.Length -gt 0) 'Copilot response missing answer'
  Assert-True ($advancedCopilot.data.mainAnalysis.Length -gt 0) 'Advanced copilot response missing analysis'
  Assert-True ($assistant.data.reply.Length -gt 0) 'Dashboard assistant response missing reply'
  Assert-True ($socialAnalysis.data.intent.Length -gt 0) 'Social analysis missing intent'
  Assert-True ($socialReply.data.reply.Length -gt 0) 'Social reply missing reply'
  Assert-True ($orderExtraction.data.status.Length -gt 0) 'Order extraction missing status'
  Assert-True ($marketingCopy.data.subject.Length -gt 0) 'Marketing copy missing subject'
  Assert-True ($adCopy.data.headline.Length -gt 0) 'Ad copy missing headline'

  $tempLead = Invoke-Api Post '/api/leads' @{
    name = 'Smoke Test Lead'
    category = 'QA'
    phone = '20000000'
    city = 'Tunis'
    source = 'Smoke'
    status = 'nouveau'
  }
  $patchedLead = Invoke-Api Patch "/api/leads/$($tempLead.data.id)" @{ status = 'contacte' }
  $deletedLead = Invoke-Api Delete "/api/leads/$($tempLead.data.id)"
  Assert-True ($patchedLead.data.status -eq 'contacte') 'Lead patch failed'
  Assert-True ($deletedLead.data.id -eq $tempLead.data.id) 'Lead delete failed'

  $tempDelivery = Invoke-Api Post '/api/deliveries' @{
    company = 'Smoke Courier'
    city = 'Tunis'
    address = 'Smoke Address'
    status = 'Waiting'
    trackingNumber = "SMK-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
  }
  $fetchedDelivery = Invoke-Api Get "/api/deliveries/$($tempDelivery.data.id)"
  $patchedDelivery = Invoke-Api Patch "/api/deliveries/$($tempDelivery.data.id)" @{ status = 'Assigned' }
  $deletedDelivery = Invoke-Api Delete "/api/deliveries/$($tempDelivery.data.id)"
  Assert-True ($fetchedDelivery.data.id -eq $tempDelivery.data.id) 'Delivery get failed'
  Assert-True ($patchedDelivery.data.status -eq 'Assigned') 'Delivery patch failed'
  Assert-True ($deletedDelivery.data.id -eq $tempDelivery.data.id) 'Delivery delete failed'

  $tempExpense = Invoke-Api Post '/api/expenses' @{
    title = 'Smoke Test Expense'
    category = 'QA'
    amount = 1
    paymentMethod = 'Cash'
  }
  $patchedExpense = Invoke-Api Patch "/api/expenses/$($tempExpense.data.id)" @{ amount = 2 }
  $deletedExpense = Invoke-Api Delete "/api/expenses/$($tempExpense.data.id)"
  Assert-True ($patchedExpense.data.amount -eq 2) 'Expense patch failed'
  Assert-True ($deletedExpense.data.id -eq $tempExpense.data.id) 'Expense delete failed'

  $tempMarketing = Invoke-Api Post '/api/marketing/campaigns' @{
    name = 'Smoke Test Campaign'
    channel = 'Email'
    segment = 'QA'
    subject = 'Smoke'
    body = 'Smoke body'
    status = 'Draft'
  }
  $fetchedMarketing = Invoke-Api Get "/api/marketing/campaigns/$($tempMarketing.data.id)"
  $deletedMarketing = Invoke-Api Delete "/api/marketing/campaigns/$($tempMarketing.data.id)"
  Assert-True ($fetchedMarketing.data.id -eq $tempMarketing.data.id) 'Marketing get failed'
  Assert-True ($deletedMarketing.data.id -eq $tempMarketing.data.id) 'Marketing delete failed'

  $tempAd = Invoke-Api Post '/api/ads/campaigns' @{
    name = 'Smoke Test Ad'
    platform = 'Manual'
    objective = 'QA'
    status = 'Draft'
    budget = 1
    impressions = 0
    clicks = 0
    leads = 0
    orders = 0
    revenue = 0
  }
  $fetchedAd = Invoke-Api Get "/api/ads/campaigns/$($tempAd.data.id)"
  $deletedAd = Invoke-Api Delete "/api/ads/campaigns/$($tempAd.data.id)"
  Assert-True ($fetchedAd.data.id -eq $tempAd.data.id) 'Ad get failed'
  Assert-True ($deletedAd.data.id -eq $tempAd.data.id) 'Ad delete failed'

  $tempChannel = Invoke-Api Post '/api/sales-channels' @{
    provider = 'shopify'
    name = 'Smoke Test Channel'
    enabled = $false
    status = 'disconnected'
  }
  $fetchedChannel = Invoke-Api Get "/api/sales-channels/$($tempChannel.data.id)"
  $deletedChannel = Invoke-Api Delete "/api/sales-channels/$($tempChannel.data.id)"
  Assert-True ($fetchedChannel.data.id -eq $tempChannel.data.id) 'Sales channel get failed'
  Assert-True ($deletedChannel.data.id -eq $tempChannel.data.id) 'Sales channel delete failed'

  $orderForDocs = @($orders.data | Where-Object { $_.lineItems -and $_.lineItems.Count -gt 0 } | Select-Object -First 1)
  if ($orderForDocs.Count -gt 0) {
    $invoice = Invoke-Api Post '/api/invoices' @{ orderId = $orderForDocs[0].id }
    $invoicePdf = Invoke-Api Get "/api/invoices/$($invoice.data.id)/pdf"
    $deletedInvoice = Invoke-Api Delete "/api/invoices/$($invoice.data.id)"
    Assert-True ($invoicePdf.data.contentType -eq 'application/pdf') 'Invoice PDF failed'
    Assert-True ($deletedInvoice.data.id -eq $invoice.data.id) 'Invoice delete failed'

    $deliveryNote = Invoke-Api Post '/api/delivery-notes/generate' @{ orderId = $orderForDocs[0].id }
    $deliveryNotePdf = Invoke-Api Get "/api/delivery-notes/$($deliveryNote.data.id)/pdf"
    $patchedDeliveryNote = Invoke-Api Patch "/api/delivery-notes/$($deliveryNote.data.id)" @{ status = 'Assigned' }
    $deletedDeliveryNote = Invoke-Api Delete "/api/delivery-notes/$($deliveryNote.data.id)"
    Assert-True ($deliveryNotePdf.data.contentType -eq 'application/pdf') 'Delivery note PDF failed'
    Assert-True ($patchedDeliveryNote.data.status -eq 'Assigned') 'Delivery note patch failed'
    Assert-True ($deletedDeliveryNote.data.id -eq $deliveryNote.data.id) 'Delivery note delete failed'
  }

  $logout = Invoke-Api Post '/api/auth/logout' @{ refreshToken = $login.data.refreshToken }
  Assert-True ($logout.data.success -eq $true) 'Logout failed'

  "HEALTH_OK=$($health.data.ok) USER=$($me.data.user.email) ORDERS=$($orders.meta.total) PRODUCTS=$($products.meta.total) CUSTOMERS=$($customers.meta.total) STOCK_MOVEMENTS=$($stockMovements.meta.total) STOCK_ALERTS=$($stockAlerts.meta.total) DELIVERIES=$($deliveries.meta.total) DELIVERY_REPORT=$($deliveryReport.data.total) INVOICES=$($invoices.meta.total) DELIVERY_NOTES=$($deliveryNotes.meta.total) ACCOUNTING_REVENUE=$($accounting.data.revenue) ACCOUNTING_PROFIT=$($accountingDashboard.data.profit) ADS=$($ads.meta.total) MARKETING=$($marketing.meta.total) TEMPLATES=$($templates.meta.total) ANALYTICS_ORDERS=$($analytics.data.kpis.orders) INTEGRATIONS=$($integrations.meta.total) INTEGRATION_HEALTH=$($integrationHealth.data.ok) CHANNELS=$($channels.meta.total) SYNC_JOBS=$($syncJobs.meta.total) SEARCH=$($search.meta.total) NOTIFICATIONS=$($notifications.meta.total) AGENT_CHANNELS=$($agentChannels.data.Count) AGENT_CONVERSATIONS=$($agentConversations.meta.total) AGENT_RULES=$($agentRules.meta.total) LOGOUT=$($logout.data.success)"
}
finally {
  if ($p -and -not $p.HasExited) {
    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
  }
  if (Test-Path -LiteralPath $backupDataDir) {
    Get-ChildItem -Path $backupDataDir -Filter '*.json' -File | ForEach-Object {
      Copy-Item -LiteralPath $_.FullName -Destination $dataDir -Force
    }
  }
  if (Test-Path -LiteralPath $backupRoot) {
    Remove-Item -LiteralPath $backupRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
