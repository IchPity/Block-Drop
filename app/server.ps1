#Requires -Version 5.1
$dir     = Split-Path -Parent $MyInvocation.MyCommand.Definition
$dbFile  = Join-Path $dir 'data\scores.json'
$achFile = Join-Path $dir 'data\achievements.json'
$usrFile = Join-Path $dir 'data\users.json'

$script:sessions   = @{}
$script:chessRooms = @{}

function New-RoomCode {
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    $code  = ''
    for ($i = 0; $i -lt 6; $i++) { $code += $chars[(Get-Random -Maximum $chars.Length)] }
    return $code
}

# ── Helpers ──────────────────────────────────────────────────────────────────

function Send-Json($response, $obj, [int]$code = 200) {
    $json  = if ($obj -is [string]) { $obj } else { ConvertTo-Json $obj -Depth 5 -Compress }
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $response.StatusCode      = $code
    $response.ContentType     = 'application/json; charset=utf-8'
    $response.ContentLength64 = $bytes.Length
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Read-Body($req) {
    [System.IO.StreamReader]::new($req.InputStream, [System.Text.Encoding]::UTF8).ReadToEnd()
}

function Get-SessionToken($req) {
    $auth = $req.Headers['Authorization']
    if ($auth -and $auth.StartsWith('Bearer ')) { return $auth.Substring(7) }
    return $req.QueryString['token']
}

function Get-Session($req) {
    $tok = Get-SessionToken $req
    if (-not $tok) { return $null }
    if ($script:sessions.ContainsKey($tok)) {
        $s = $script:sessions[$tok]
        if ($s.expires -gt (Get-Date)) { return $s }
        $script:sessions.Remove($tok)
    }
    return $null
}

# ── Users ─────────────────────────────────────────────────────────────────────

function Load-Users {
    if (-not (Test-Path $usrFile)) {
        $init = [PSCustomObject]@{
            users = @([PSCustomObject]@{
                username  = 'Peter'
                password  = 'Admin111'
                role      = 'admin'
                createdAt = (Get-Date -Format 'yyyy-MM-dd')
            })
        }
        $init | ConvertTo-Json -Depth 5 | Set-Content $usrFile -Encoding utf8
        return @($init.users)
    }
    try {
        $p = Get-Content $usrFile -Raw -Encoding utf8 | ConvertFrom-Json
        return @($p.users | Where-Object { $_ })
    } catch { return @() }
}

function Save-Users($users) {
    [PSCustomObject]@{ users = @($users) } | ConvertTo-Json -Depth 5 | Set-Content $usrFile -Encoding utf8
}

# ── Scores ────────────────────────────────────────────────────────────────────

function Load-Scores([string]$mode) {
    if (-not (Test-Path $dbFile)) { return @() }
    try {
        $parsed = Get-Content $dbFile -Raw -Encoding utf8 | ConvertFrom-Json
        $arr = $parsed.$mode
        if ($null -eq $arr) { return @() }
        return @($arr)
    } catch { return @() }
}

function Save-Score($entry, [string]$username = 'anonymous') {
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
        username = $username
        mode  = [string]$entry.mode
        score = [int]$entry.score
        level = [int]$entry.level
        lines = [int]$entry.lines
        date  = [string]$entry.date
    }
    if ($entry.mode -eq 'standard') { $standard += $new } else { $classic += $new }
    [PSCustomObject]@{ classic = $classic; standard = $standard } |
        ConvertTo-Json -Depth 5 | Set-Content $dbFile -Encoding utf8
}

# ── Achievements ──────────────────────────────────────────────────────────────

function Load-Achievements {
    if (-not (Test-Path $achFile)) { return '{"unlocked":[]}' }
    try { return Get-Content $achFile -Raw -Encoding utf8 }
    catch { return '{"unlocked":[]}' }
}

function Save-Achievement($entry, [string]$username = 'anonymous') {
    $unlocked = @()
    if (Test-Path $achFile) {
        try {
            $parsed   = Get-Content $achFile -Raw -Encoding utf8 | ConvertFrom-Json
            $unlocked = @($parsed.unlocked | Where-Object { $_ })
        } catch {}
    }
    if ($unlocked | Where-Object { $_.id -eq $entry.id -and $_.username -eq $username }) { return $false }
    $new      = [PSCustomObject]@{ id = [string]$entry.id; unlockedAt = [string]$entry.unlockedAt; username = $username }
    $unlocked += $new
    [PSCustomObject]@{ unlocked = $unlocked } | ConvertTo-Json -Depth 5 | Set-Content $achFile -Encoding utf8
    return $true
}

# ── Netzwerk-Erkennung ────────────────────────────────────────────────────────

$localIP = $null
try {
    $localIP = (Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixLength -lt 32 } |
        Sort-Object { if ($_.PrefixOrigin -eq 'Dhcp') { 0 } else { 1 } } |
        Select-Object -First 1).IPAddress
} catch {}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add('http://+:3000/')
$listener.Start()

Write-Host ''
Write-Host '  +==============================+' -ForegroundColor DarkGray
Write-Host '  |    BLOCK DROP  ARCADE        |' -ForegroundColor White
Write-Host '  +==============================+' -ForegroundColor DarkGray
Write-Host ''
Write-Host "  Lokal:    http://localhost:3000" -ForegroundColor Cyan
if ($localIP) {
    Write-Host "  Netzwerk: http://${localIP}:3000" -ForegroundColor Yellow
    Write-Host ''
    Write-Host '  Teile den Netzwerk-Link mit Freunden im selben WLAN.' -ForegroundColor DarkGray
}
Write-Host ''
Write-Host '  Zum Beenden: Strg+C' -ForegroundColor DarkGray
Write-Host ''

# ── Request-Loop ──────────────────────────────────────────────────────────────

try {
    while ($true) {
        $ctx = $listener.GetContext()
        $req = $ctx.Request
        $res = $ctx.Response
        try {
            $p = $req.Url.AbsolutePath
            $m = $req.HttpMethod

            $res.Headers.Add('Access-Control-Allow-Origin',  '*')
            $res.Headers.Add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
            $res.Headers.Add('Access-Control-Allow-Headers', 'Content-Type,Authorization')

            if ($m -eq 'OPTIONS') {
                $res.StatusCode = 204

            } elseif ($p -eq '/api/auth/login' -and $m -eq 'POST') {
                $creds = ConvertFrom-Json (Read-Body $req)
                $users = Load-Users
                $u = $users | Where-Object { $_.username -eq $creds.username -and $_.password -eq $creds.password } | Select-Object -First 1
                if ($u) {
                    $tok = [System.Guid]::NewGuid().ToString('N')
                    $script:sessions[$tok] = @{ username = [string]$u.username; role = [string]$u.role; expires = (Get-Date).AddHours(24) }
                    Send-Json $res @{ ok = $true; token = $tok; username = $u.username; role = $u.role }
                } else {
                    Send-Json $res @{ ok = $false; error = 'Ungültige Zugangsdaten' } 401
                }

            } elseif ($p -eq '/api/auth/register' -and $m -eq 'POST') {
                $creds = ConvertFrom-Json (Read-Body $req)
                $uname = [string]$creds.username
                $upass = [string]$creds.password
                if (-not $uname -or -not $upass) {
                    Send-Json $res @{ ok = $false; error = 'Benutzername und Passwort erforderlich' } 400
                } else {
                    $users = Load-Users
                    if ($users | Where-Object { $_.username -eq $uname }) {
                        Send-Json $res @{ ok = $false; error = 'Benutzername bereits vergeben' } 409
                    } else {
                        $nu = [PSCustomObject]@{ username = $uname; password = $upass; role = 'user'; createdAt = (Get-Date -Format 'yyyy-MM-dd') }
                        $users += $nu
                        Save-Users $users
                        $tok = [System.Guid]::NewGuid().ToString('N')
                        $script:sessions[$tok] = @{ username = $uname; role = 'user'; expires = (Get-Date).AddHours(24) }
                        Send-Json $res @{ ok = $true; token = $tok; username = $uname; role = 'user' }
                    }
                }

            } elseif ($p -eq '/api/auth/verify' -and $m -eq 'GET') {
                $s = Get-Session $req
                if ($s) { Send-Json $res @{ ok = $true; username = $s.username; role = $s.role } }
                else    { Send-Json $res @{ ok = $false } 401 }

            } elseif ($p -eq '/api/auth/logout' -and $m -eq 'POST') {
                $tok = Get-SessionToken $req
                if ($tok) { $script:sessions.Remove($tok) }
                Send-Json $res @{ ok = $true }

            } elseif ($p -eq '/api/users' -and $m -eq 'GET') {
                $s = Get-Session $req
                if (-not $s -or $s.role -ne 'admin') {
                    Send-Json $res @{ ok = $false; error = 'Zugriff verweigert' } 403
                } else {
                    $uArr  = @(Load-Users)
                    $uJson = if ($uArr.Count -gt 0) { ConvertTo-Json $uArr -Depth 5 -Compress } else { '[]' }
                    Send-Json $res ('{"ok":true,"users":' + $uJson + '}')
                }

            } elseif ($p -eq '/api/scores' -and $m -eq 'GET') {
                $mode   = if ($req.QueryString['mode']) { $req.QueryString['mode'] } else { 'classic' }
                $scores = Load-Scores $mode
                $sorted = $scores | Sort-Object { -[double]$_.score } | Select-Object -First 10
                $json   = if ($sorted) { ConvertTo-Json @($sorted) -Depth 5 } else { '[]' }
                $bytes  = [System.Text.Encoding]::UTF8.GetBytes($json)
                $res.ContentType     = 'application/json'
                $res.ContentLength64 = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)

            } elseif ($p -eq '/api/scores' -and $m -eq 'POST') {
                $s     = Get-Session $req
                $uname = if ($s) { $s.username } else { 'anonymous' }
                Save-Score (ConvertFrom-Json (Read-Body $req)) $uname
                $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true}')
                $res.ContentType     = 'application/json'
                $res.ContentLength64 = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)

            } elseif ($p -eq '/api/achievements' -and $m -eq 'GET') {
                $json  = Load-Achievements
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
                $res.ContentType     = 'application/json'
                $res.ContentLength64 = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)

            } elseif ($p -eq '/api/achievements' -and $m -eq 'POST') {
                $s     = Get-Session $req
                $uname = if ($s) { $s.username } else { 'anonymous' }
                $isNew = Save-Achievement (ConvertFrom-Json (Read-Body $req)) $uname
                $json  = if ($isNew) { '{"ok":true,"new":true}' } else { '{"ok":true,"new":false}' }
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
                $res.ContentType     = 'application/json'
                $res.ContentLength64 = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)

            } elseif ($p -eq '/api/admin/stats' -and $m -eq 'GET') {
                $s = Get-Session $req
                if (-not $s -or $s.role -ne 'admin') {
                    Send-Json $res @{ ok = $false; error = 'Zugriff verweigert' } 403
                } else {
                    $cl = @(Load-Scores 'classic')
                    $st = @(Load-Scores 'standard')
                    $allScores = @($cl + $st) | Sort-Object { -[double]$_.score }
                    $achList = @()
                    if (Test-Path $achFile) {
                        try {
                            $pd = Get-Content $achFile -Raw -Encoding utf8 | ConvertFrom-Json
                            if ($pd -and $pd.unlocked) { $achList = @($pd.unlocked | Where-Object { $_ }) }
                        } catch {}
                    }
                    $scJson  = if ($allScores.Count -gt 0) { ConvertTo-Json @($allScores) -Depth 5 -Compress } else { '[]' }
                    $achJson = if ($achList.Count -gt 0)   { ConvertTo-Json @($achList)   -Depth 5 -Compress } else { '[]' }
                    Send-Json $res ('{"ok":true,"scores":' + $scJson + ',"achievements":' + $achJson + '}')
                }

            # ── Chess Rooms ───────────────────────────────────────────────────────
            } elseif ($p -eq '/api/chess/create' -and $m -eq 'POST') {
                $body  = ConvertFrom-Json (Read-Body $req)
                $s     = Get-Session $req
                $name  = if ($s) { $s.username } elseif ($body.name) { [string]$body.name } else { 'Anonym' }
                $cpref = if ($body.color) { [string]$body.color } else { 'random' }
                $isW   = if ($cpref -eq 'random') { (Get-Random -Maximum 2) -eq 0 } else { $cpref -eq 'white' }
                do { $code = New-RoomCode } while ($script:chessRooms.ContainsKey($code))
                $script:chessRooms[$code] = [ordered]@{
                    white    = if ($isW)  { $name } else { $null }
                    black    = if (-not $isW) { $name } else { $null }
                    moves    = [System.Collections.ArrayList]@()
                    gameOver = $false
                    winner   = $null
                    created  = [datetime]::UtcNow.ToString('o')
                }
                Send-Json $res @{ ok = $true; code = $code; color = if ($isW) { 'white' } else { 'black' } }

            } elseif ($p -match '^/api/chess/join/([A-Z0-9]{6})$' -and $m -eq 'POST') {
                $code = $Matches[1]
                if (-not $script:chessRooms.ContainsKey($code)) {
                    Send-Json $res @{ ok = $false; error = 'Raum nicht gefunden' } 404
                } else {
                    $room  = $script:chessRooms[$code]
                    $body  = ConvertFrom-Json (Read-Body $req)
                    $s     = Get-Session $req
                    $name  = if ($s) { $s.username } elseif ($body.name) { [string]$body.name } else { 'Anonym' }
                    if ($null -eq $room.white) {
                        $room.white = $name; $jcolor = 'white'
                    } elseif ($null -eq $room.black) {
                        $room.black = $name; $jcolor = 'black'
                    } else {
                        Send-Json $res @{ ok = $false; error = 'Raum voll' } 409
                        continue
                    }
                    $mArr = if ($room.moves.Count -gt 0) { ConvertTo-Json @($room.moves) -Compress } else { '[]' }
                    Send-Json $res ('{"ok":true,"color":"' + $jcolor + '","white":' + (if ($room.white) { '"' + $room.white + '"' } else { 'null' }) + ',"black":' + (if ($room.black) { '"' + $room.black + '"' } else { 'null' }) + ',"moves":' + $mArr + '}')
                }

            } elseif ($p -match '^/api/chess/room/([A-Z0-9]{6})$' -and $m -eq 'GET') {
                $code = $Matches[1]
                if (-not $script:chessRooms.ContainsKey($code)) {
                    Send-Json $res @{ ok = $false; error = 'Raum nicht gefunden' } 404
                } else {
                    $room  = $script:chessRooms[$code]
                    $both  = ($null -ne $room.white -and $null -ne $room.black)
                    $mArr  = if ($room.moves.Count -gt 0) { ConvertTo-Json @($room.moves) -Compress } else { '[]' }
                    $wJson = if ($room.white) { '"' + $room.white + '"' } else { 'null' }
                    $bJson = if ($room.black) { '"' + $room.black + '"' } else { 'null' }
                    $wJson2 = if ($room.winner) { '"' + $room.winner + '"' } else { 'null' }
                    Send-Json $res ('{"ok":true,"white":' + $wJson + ',"black":' + $bJson + ',"moves":' + $mArr + ',"gameOver":' + ($room.gameOver -as [string]).ToLower() + ',"winner":' + $wJson2 + ',"bothJoined":' + ($both -as [string]).ToLower() + ',"code":"' + $code + '"}')
                }

            } elseif ($p -match '^/api/chess/move/([A-Z0-9]{6})$' -and $m -eq 'POST') {
                $code = $Matches[1]
                if (-not $script:chessRooms.ContainsKey($code)) {
                    Send-Json $res @{ ok = $false; error = 'Raum nicht gefunden' } 404
                } else {
                    $room = $script:chessRooms[$code]
                    $body = ConvertFrom-Json (Read-Body $req)
                    [void]$room.moves.Add([string]$body.move)
                    if ($body.gameOver -eq $true -and $body.winner) {
                        $room.gameOver = $true
                        $room.winner   = [string]$body.winner
                    }
                    Send-Json $res @{ ok = $true }
                }

            } else {
                if ($p -eq '/' -or $p -match '/$') { $p = $p.TrimEnd('/') + '/index.html' }
                if ($p -eq '') { $p = '/index.html' }
                $file = Join-Path $dir ($p.TrimStart('/').Replace('/', '\'))
                if (Test-Path $file -PathType Container) { $file = Join-Path $file 'index.html' }
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
