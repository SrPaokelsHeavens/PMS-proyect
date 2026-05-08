$files = Get-ChildItem docs/diagrams/*.mmd
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
    $base64 = [Convert]::ToBase64String($bytes)
    $base64 = $base64.Replace('+', '-').Replace('/', '_').Replace('=', '')
    $url = "https://mermaid.ink/img/$base64"
    $target = $file.FullName.Replace('.mmd', '.png')
    Write-Host "Regenerando $target..."
    Invoke-WebRequest -Uri $url -OutFile $target
}
