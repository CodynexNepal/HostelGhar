function parseOrigins($value) { 
  if ([string]::IsNullOrWhiteSpace($value) -or $value.Trim() -eq '*' ) { return @(); } 
  return $value.Split(',') | ForEach-Object { $_.Trim().TrimEnd('/').TrimEnd('\') } | Where-Object { $_ } 
} 
$value = 'https://dashboard.hostelghar.com,https://hostelghar.com' 
$parsed = parseOrigins $value 
Write-Host "Parsed origins:" 
$parsed | ForEach-Object { Write-Host "  - $_" } 
Write-Host "Count: $($parsed.Count)" 
