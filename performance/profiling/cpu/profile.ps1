param(
  [string]$NodeBinary = 'node',
  [string]$EntryPoint = 'dist/index.js'
)

Write-Host "Starting CPU profile. Stop the application with Ctrl+C after reproducing the workload."
& $NodeBinary --cpu-prof --cpu-prof-dir performance/profiling/cpu $EntryPoint
