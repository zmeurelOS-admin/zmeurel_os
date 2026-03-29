$ProgressPreference='SilentlyContinue'
$results = foreach($path in @('/','/start','/login')) {
  try {
    $r = Invoke-WebRequest -Uri ('http://127.0.0.1:3000' + $path) -UseBasicParsing
    [PSCustomObject]@{Path=$path; Status=$r.StatusCode; Length=$r.Content.Length; Snippet=($r.Content.Substring(0,[Math]::Min(180,$r.Content.Length)).Replace("`r",' ').Replace("`n",' '))}
  } catch {
    [PSCustomObject]@{Path=$path; Error=$_.Exception.Message}
  }
}
$results | ConvertTo-Json -Compress
