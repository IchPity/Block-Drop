#Requires -Version 5.1
$dir    = Split-Path -Parent $MyInvocation.MyCommand.Definition
$dbFile = Join-Path $dir 'data\scores.json'

function Load-Scores([string]$mode) {
    if (-not (Test-Path $dbFile)) { return @() }
    try {
        $parsed = Get-Content $dbFile -Raw -Encoding utf8 | ConvertFrom-Json
        $arr = $parsed.$mode
        if ($null -eq $arr) { return @() }
        return @($arr)
    } catch { return @() }
}

function Save-Score($entry) {
    $classic  = @()
    $standard = @()
    if (Test-Path $dbFile) {
        try {
            $parsed   = Get-Content $dbFile -Raw -Encoding utf8 | ConvertFrom-Json
            $classic  = @($parsed.classic  | Where-Object { $_ })
            $standard = @($parsed.standard | Where-Object { $_ })
        } catch {}
    }
    $new = [PSCustomObject]@{
        mode  = [string]$entry.mode
        score = [int]$entry.score
        level = [int]$entry.level
        lines = [int]$entry.lines
        date  = [string]$entry.date
    }
    if ($entry.mode -eq 'standard') { $standard += $new } else { $classic += $new }
    [PSCustomObject]@{ classic = $classic; standard = $standard } |
        ConvertTo-Json -Depth 5 |
        Set-Content $dbFile -Encoding utf8
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add('http://localhost:3000/')
$listener.Start()

Write-Host 'Block Drop laeuft auf http://localhost:3000' -ForegroundColor Green
Write-Host 'Scores werden in scores.json gespeichert.'   -ForegroundColor Cyan
Write-Host 'Zum Beenden: Strg+C'                         -ForegroundColor Yellow

try {
    while ($true) {
        $ctx = $listener.GetContext()
        $req = $ctx.Request
        $res = $ctx.Response
        try {
            $p = $req.Url.AbsolutePath

            if ($p -eq '/api/scores' -and $req.HttpMethod -eq 'GET') {
                $mode   = if ($req.QueryString['mode']) { $req.QueryString['mode'] } else { 'classic' }
                $scores = Load-Scores $mode
                $sorted = $scores | Sort-Object { -[double]$_.score } | Select-Object -First 10
                $json   = if ($sorted) { ConvertTo-Json @($sorted) -Depth 5 } else { '[]' }
                $bytes  = [System.Text.Encoding]::UTF8.GetBytes($json)
                $res.ContentType     = 'application/json'
                $res.ContentLength64 = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)

            } elseif ($p -eq '/api/scores' -and $req.HttpMethod -eq 'POST') {
                $body  = [System.IO.StreamReader]::new($req.InputStream, [System.Text.Encoding]::UTF8).ReadToEnd()
                Save-Score (ConvertFrom-Json $body)
                $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true}')
                $res.ContentType     = 'application/json'
                $res.ContentLength64 = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)

            } else {
                if ($p -eq '/' -or $p -match '/$') { $p = $p.TrimEnd('/') + '/index.html' }
                if ($p -eq '') { $p = '/index.html' }
                $file = Join-Path $dir ($p.TrimStart('/').Replace('/', '\'))
                if (Test-Path $file -PathType Leaf) {
                    $bytes = [System.IO.File]::ReadAllBytes($file)
                    $res.ContentType = switch ([System.IO.Path]::GetExtension($file).ToLower()) {
                        '.html' { 'text/html; charset=utf-8' }
                        '.js'   { 'text/javascript; charset=utf-8' }
                        '.css'  { 'text/css; charset=utf-8' }
                        default { 'application/octet-stream' }
                    }
                    $res.ContentLength64 = $bytes.Length
                    $res.OutputStream.Write($bytes, 0, $bytes.Length)
                } else {
                    $res.StatusCode = 404
                    $b = [System.Text.Encoding]::UTF8.GetBytes('Not found')
                    $res.ContentLength64 = $b.Length
                    $res.OutputStream.Write($b, 0, $b.Length)
                }
            }
        } catch { $res.StatusCode = 500 }
        finally  { $res.Close() }
    }
} finally { $listener.Stop() }
