param(
  [string]$NodeBinary = 'node',
  [string]$EntryPoint = 'dist/index.js'
)

Write-Host "Starting heap snapshot capture. Stop the process after reproducing the suspected memory behavior."
& $NodeBinary --heapsnapshot-signal=SIGUSR2 $EntryPoint
