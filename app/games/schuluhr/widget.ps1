Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase

# ── Schedule ──────────────────────────────────────────────────
$MORNING = @(
    @{T='class';N='1. Stunde';   H1=7; M1=50; H2=8; M2=40}
    @{T='break';N='Pause';        H1=8; M1=40; H2=8; M2=45}
    @{T='class';N='2. Stunde';   H1=8; M1=45; H2=9; M2=35}
    @{T='break';N='Pause';        H1=9; M1=35; H2=9; M2=40}
    @{T='class';N='3. Stunde';   H1=9; M1=40; H2=10;M2=30}
    @{T='break';N='Große Pause'; H1=10;M1=30; H2=10;M2=45}
    @{T='class';N='4. Stunde';   H1=10;M1=45; H2=11;M2=35}
    @{T='break';N='Pause';        H1=11;M1=35; H2=11;M2=40}
    @{T='class';N='5. Stunde';   H1=11;M1=40; H2=12;M2=30}
    @{T='break';N='Pause';        H1=12;M1=30; H2=12;M2=35}
    @{T='class';N='6. Stunde';   H1=12;M1=35; H2=13;M2=25}
)
$MON_AFT = @(
    @{T='lunch';N='Mittagspause';H1=13;M1=25; H2=14;M2=15}
    @{T='class';N='7. Stunde';   H1=14;M1=15; H2=15;M2=5}
    @{T='class';N='8. Stunde';   H1=15;M1=5;  H2=15;M2=55}
)

# ── Helpers ───────────────────────────────────────────────────
function toMin($h,$m)  { $h*60+$m }
function z($n)         { $n.ToString('D2') }
function fmtCd($sec) {
    $s=[Math]::Max(0,[Math]::Floor($sec))
    $h=[Math]::Floor($s/3600); $m=[Math]::Floor(($s%3600)/60); $ss=$s%60
    if($h -gt 0){ "$(z $h):$(z $m):$(z $ss)" } else { "$(z $m):$(z $ss)" }
}
function nextSchool($now) {
    $d=[datetime]::new($now.Year,$now.Month,$now.Day,7,50,0).AddDays(1)
    while($d.DayOfWeek -in 'Saturday','Sunday'){ $d=$d.AddDays(1) }
    $d
}
function freeCd($now) {
    $next=nextSchool $now
    $diff=[Math]::Max(0,[Math]::Floor(($next-$now).TotalSeconds))
    $dh=[Math]::Floor($diff/3600); $dm=[Math]::Floor(($diff%3600)/60); $ds=$diff%60
    if($dh -ge 24){ "$([Math]::Floor($dh/24))d $(z($dh%24)):$(z $dm):$(z $ds)" }
    else { "$(z $dh):$(z $dm):$(z $ds)" }
}
function brush($hex) {
    $h=$hex.TrimStart('#')
    [System.Windows.Media.SolidColorBrush][System.Windows.Media.Color]::FromArgb(
        255,
        [Convert]::ToInt32($h.Substring(0,2),16),
        [Convert]::ToInt32($h.Substring(2,2),16),
        [Convert]::ToInt32($h.Substring(4,2),16)
    )
}

# ── XAML ──────────────────────────────────────────────────────
[xml]$xaml = @'
<Window
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
    Title="SchulUhr" Width="262" Height="152"
    WindowStyle="None" AllowsTransparency="True"
    Background="Transparent" Topmost="True"
    ResizeMode="NoResize" ShowInTaskbar="True">
  <Border CornerRadius="14" BorderThickness="1" BorderBrush="#1E1E38" ClipToBounds="True">
    <Border.Background>
      <SolidColorBrush Color="#E5080812"/>
    </Border.Background>
    <Grid>
      <Grid.RowDefinitions>
        <RowDefinition Height="3"/>
        <RowDefinition Height="*"/>
      </Grid.RowDefinitions>

      <!-- colored top accent bar -->
      <Rectangle x:Name="topBar" Grid.Row="0" Fill="#7C6FFF"/>

      <!-- main content -->
      <StackPanel Grid.Row="1" Margin="14,8,14,10">

        <!-- badge row -->
        <Grid Margin="0,0,0,3">
          <Grid.ColumnDefinitions>
            <ColumnDefinition Width="*"/>
            <ColumnDefinition Width="Auto"/>
          </Grid.ColumnDefinitions>
          <TextBlock x:Name="badgeText" Grid.Column="0"
                     FontSize="8" FontWeight="Bold" FontFamily="Segoe UI"
                     VerticalAlignment="Center"/>
          <Button x:Name="closeBtn" Grid.Column="1" Content="✕"
                  FontSize="10" BorderThickness="0" Padding="5,2"
                  Cursor="Hand" Background="Transparent" Foreground="#3A3A55"/>
        </Grid>

        <!-- period name -->
        <TextBlock x:Name="nameText" FontSize="9.5" FontFamily="Segoe UI"
                   Foreground="#606080" Margin="0,0,0,1"
                   TextTrimming="CharacterEllipsis"/>

        <!-- countdown -->
        <TextBlock x:Name="cdText" FontSize="30" FontWeight="Bold"
                   FontFamily="Consolas" LineHeight="32" Margin="0,0,0,1"/>

        <!-- label -->
        <TextBlock x:Name="labelText" FontSize="7.5" FontFamily="Segoe UI"
                   Foreground="#3A3A55" Margin="0,1,0,7"/>

        <!-- progress bar -->
        <Grid Height="3" Margin="0,0,0,7">
          <Rectangle Fill="#14142A" RadiusX="2" RadiusY="2"/>
          <Rectangle x:Name="progFill" RadiusX="2" RadiusY="2"
                     HorizontalAlignment="Left" Width="0"/>
        </Grid>

        <!-- next -->
        <TextBlock x:Name="nextText" FontSize="8" FontFamily="Segoe UI"
                   Foreground="#3A3A55" TextTrimming="CharacterEllipsis"/>
      </StackPanel>
    </Grid>
  </Border>
</Window>
'@

$reader = New-Object System.Xml.XmlNodeReader $xaml
$win    = [System.Windows.Markup.XamlReader]::Load($reader)

$topBar    = $win.FindName('topBar')
$badgeText = $win.FindName('badgeText')
$closeBtn  = $win.FindName('closeBtn')
$nameText  = $win.FindName('nameText')
$cdText    = $win.FindName('cdText')
$labelText = $win.FindName('labelText')
$progFill  = $win.FindName('progFill')
$nextText  = $win.FindName('nextText')

# ── Close & Drag ──────────────────────────────────────────────
$closeBtn.Add_Click({ $win.Close() })
$win.Add_MouseLeftButtonDown({
    if (-not ($_.OriginalSource -is [System.Windows.Controls.Button])) {
        $win.DragMove()
    }
})

# Right-click to close
$win.Add_MouseRightButtonDown({ $win.Close() })

# ── Color helper ──────────────────────────────────────────────
$PROG_MAX = 230   # usable progress bar width in px

function Set-Theme($barHex, $fgHex) {
    $b = brush $fgHex
    $topBar.Fill      = brush $barHex
    $badgeText.Foreground = $b
    $cdText.Foreground    = $b
    $progFill.Fill        = $b
}

# ── Update ────────────────────────────────────────────────────
function Update-Win {
    $now = Get-Date
    $dow = [int]$now.DayOfWeek   # 0=Sun, 6=Sat
    $cur = (toMin $now.Hour $now.Minute) + $now.Second / 60.0

    $isWeekend = $dow -eq 0 -or $dow -eq 6
    $isMon     = $dow -eq 1
    $isFri     = $dow -eq 5
    $isSchool  = $dow -ge 1 -and $dow -le 5

    $start   = toMin 7 50
    $midEnd  = toMin 13 25
    $monEnd  = toMin 15 55

    $free = $isWeekend `
         -or ($isFri    -and $cur -ge $midEnd) `
         -or (-not $isMon -and $isSchool -and $cur -ge $midEnd) `
         -or ($isMon    -and $cur -ge $monEnd)

    # ── ENDLICH FREI ──────────────────────────────────────────
    if ($free) {
        Set-Theme '#4ADE80' '#4ADE80'
        $badgeText.Text  = '● ENDLICH FREI'
        $nameText.Text   = ''
        $cdText.Text     = freeCd $now
        $cdText.FontSize = 22
        $labelText.Text  = 'bis Schule wieder beginnt'
        $progFill.Width  = $PROG_MAX
        $nd = nextSchool $now
        $dayNames = 'So','Mo','Di','Mi','Do','Fr','Sa'
        $nextText.Text = "Nächster Schultag: $($dayNames[[int]$nd.DayOfWeek]) $($nd.ToString('dd.MM.'))"
        return
    }

    # ── VOR DER SCHULE ────────────────────────────────────────
    if ($isSchool -and $cur -lt $start) {
        Set-Theme '#F87171' '#F87171'
        $badgeText.Text  = '● BALD LOS'
        $nameText.Text   = 'Schulbeginn 07:50 Uhr'
        $cdText.Text     = fmtCd (($start - $cur) * 60)
        $cdText.FontSize = 30
        $labelText.Text  = 'bis Schulbeginn'
        $progFill.Width  = 0
        $nextText.Text   = 'Nächstes: 1. Stunde'
        return
    }

    # ── WÄHREND DER SCHULE ────────────────────────────────────
    if ($isSchool) {
        $sched = if ($isMon) { $MORNING + $MON_AFT } else { $MORNING }
        for ($i = 0; $i -lt $sched.Count; $i++) {
            $sl = $sched[$i]
            $s  = toMin $sl.H1 $sl.M1
            $e  = toMin $sl.H2 $sl.M2
            if ($cur -ge $s -and $cur -lt $e) {
                $left = ($e - $cur) * 60
                $prog = [Math]::Min(1.0, ($cur - $s) / ($e - $s))

                switch ($sl.T) {
                    'lunch' { Set-Theme '#F97316' '#FB923C'; $bl='● MITTAGSPAUSE'; $cl='bis Unterrichtsbeginn' }
                    'break' { Set-Theme '#FBBF24' '#FBBF24'; $bl='● PAUSE';        $cl='bis Unterrichtsbeginn' }
                    default { Set-Theme '#7C6FFF' '#7C6FFF'; $bl='● UNTERRICHT';   $cl='bis zur Pause' }
                }

                $badgeText.Text  = $bl
                $nameText.Text   = "$($sl.N)  $(z $sl.H1):$(z $sl.M1) – $(z $sl.H2):$(z $sl.M2)"
                $cdText.Text     = fmtCd $left
                $cdText.FontSize = 30
                $labelText.Text  = $cl
                $progFill.Width  = $PROG_MAX * $prog

                if ($i -lt $sched.Count - 1) {
                    $nx = $sched[$i + 1]
                    $nextText.Text = "Danach: $($nx.N)"
                } else {
                    $nextText.Text = 'Danach: Endlich Frei!'
                }
                return
            }
        }
    }
}

# ── Position (bottom-right, above taskbar) ────────────────────
$area      = [System.Windows.SystemParameters]::WorkArea
$win.Left  = $area.Right  - $win.Width  - 24
$win.Top   = $area.Bottom - $win.Height - 24

# ── Timer ─────────────────────────────────────────────────────
$timer          = New-Object System.Windows.Threading.DispatcherTimer
$timer.Interval = [TimeSpan]::FromSeconds(1)
$timer.Add_Tick({ Update-Win })
$timer.Start()
Update-Win

$win.ShowDialog() | Out-Null
