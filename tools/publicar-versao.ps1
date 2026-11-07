<#
.SYNOPSIS
  Publica uma versão do Magistrado: sobe o número, escreve versao.json e HISTORICO.md, faz o commit, a tag e envia.

.EXAMPLE
  .\tools\publicar-versao.ps1 -Versao 0.9.1 -Notas "Correção: rolagem de dano","Aviso de versão nova"

.EXAMPLE
  .\tools\publicar-versao.ps1 -Versao 1.0.0 -Notas "Primeira versão oficial" -Obrigatoria

  -Obrigatoria: quem estiver numa versão abaixo desta precisa atualizar (o aviso não fecha).
  -SemEnviar: faz tudo localmente (commit e tag), sem push nem release no GitHub.
  -Rodape: linhas extras no fim da mensagem do commit (ex.: Co-Authored-By).
#>
param(
  [Parameter(Mandatory = $true)][string]$Versao,
  [Parameter(Mandatory = $true)][string[]]$Notas,
  [switch]$Obrigatoria,
  [switch]$SemEnviar,
  [switch]$SemTestes,
  [string]$Rodape = ''
)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$app = Join-Path $raiz 'app'
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Falhar($msg) { Write-Host "ERRO: $msg" -ForegroundColor Red; exit 1 }
function Rodar-Git { & git -C $raiz @args; if ($LASTEXITCODE -ne 0) { Falhar "git $($args -join ' ') falhou" } }
function Comparar($a, $b) { ([version]$a).CompareTo([version]$b) }

if ($Versao -notmatch '^\d+\.\d+\.\d+$') { Falhar "A versão precisa ser no formato 1.2.3 (recebi '$Versao')." }
$Notas = @($Notas | Where-Object { $_ -and $_.Trim() } | ForEach-Object { $_.Trim() })
if ($Notas.Count -eq 0) { Falhar 'Escreva pelo menos uma nota com o que mudou.' }

# 1. A cópia precisa estar limpa, no main e em dia com o GitHub.
$ramo = (& git -C $raiz rev-parse --abbrev-ref HEAD).Trim()
if ($ramo -ne 'main') { Falhar "Publique a partir do main (está em '$ramo')." }
if (& git -C $raiz status --porcelain --untracked-files=no) { Falhar 'Há alterações sem commit. Faça o commit antes de publicar.' }
if (-not $SemEnviar) {
  Rodar-Git fetch --quiet origin main
  $atras = [int](& git -C $raiz rev-list --count 'HEAD..origin/main')
  if ($atras -gt 0) { Falhar "O main local está $atras commit(s) atrás do GitHub. Rode git pull antes." }
}

# 2. O número precisa ser maior que o atual e que o publicado.
$pacote = Get-Content (Join-Path $app 'package.json') -Raw | ConvertFrom-Json
if ((Comparar $Versao $pacote.version) -le 0) { Falhar "A versão $Versao não é maior que a atual ($($pacote.version))." }
$arqVersao = Join-Path $raiz 'versao.json'
$minimo = '0.0.0'
if (Test-Path $arqVersao) {
  $publicada = Get-Content $arqVersao -Raw | ConvertFrom-Json
  if ((Comparar $Versao $publicada.versao) -le 0) { Falhar "A versão $Versao não é maior que a publicada ($($publicada.versao))." }
  if ($publicada.minimo) { $minimo = $publicada.minimo }
}
if ($Obrigatoria) { $minimo = $Versao }
if (& git -C $raiz tag --list "v$Versao") { Falhar "A tag v$Versao já existe." }

# 3. Testes antes de marcar a versão.
if (-not $SemTestes) {
  Push-Location $app
  try {
    & npm.cmd run typecheck; if ($LASTEXITCODE -ne 0) { Falhar 'typecheck falhou.' }
    & npm.cmd test; if ($LASTEXITCODE -ne 0) { Falhar 'testes falharam.' }
  } finally { Pop-Location }
}

# 4. Número no package.json e no package-lock.json.
Push-Location $app
try {
  & npm.cmd version $Versao --no-git-tag-version --allow-same-version | Out-Null
  if ($LASTEXITCODE -ne 0) { Falhar 'npm version falhou.' }
} finally { Pop-Location }

# 5. versao.json (o que o app consulta) e HISTORICO.md (o que a gente lê).
$hoje = Get-Date
$json = [ordered]@{ versao = $Versao; minimo = $minimo; publicada_em = $hoje.ToString('yyyy-MM-dd'); notas = $Notas }
[IO.File]::WriteAllText($arqVersao, ((ConvertTo-Json -InputObject $json -Depth 3) + "`n"), $utf8)

$arqHist = Join-Path $raiz 'HISTORICO.md'
$cabecalho = "# Histórico de versões — Magistrado`n`nDa versão mais recente para a mais antiga.`n"
$corpo = ''
if (Test-Path $arqHist) {
  $antigo = [IO.File]::ReadAllText($arqHist, $utf8)
  $i = $antigo.IndexOf("`n## ")
  if ($i -ge 0) { $corpo = $antigo.Substring($i + 1) }
}
$secao = "## $Versao — $($hoje.ToString('dd/MM/yyyy'))`n`n"
if ($Obrigatoria) { $secao += "**Atualização obrigatória.**`n`n" }
$secao += (($Notas | ForEach-Object { "- $_" }) -join "`n") + "`n"
[IO.File]::WriteAllText($arqHist, "$cabecalho`n$secao`n$corpo".TrimEnd() + "`n", $utf8)

# 6. Commit, tag e envio.
Rodar-Git add -- versao.json HISTORICO.md app/package.json app/package-lock.json
$mensagem = "Versão ${Versao}: $($Notas[0])"
if ($Notas.Count -gt 1) { $mensagem += "`n`n" + (($Notas | ForEach-Object { "- $_" }) -join "`n") }
if ($Rodape) { $mensagem += "`n`n$Rodape" }
$tmp = [IO.Path]::GetTempFileName()
[IO.File]::WriteAllText($tmp, $mensagem, $utf8)
Rodar-Git commit --quiet -F $tmp
Remove-Item $tmp
Rodar-Git tag -a "v$Versao" -m "Magistrado $Versao"

if ($SemEnviar) {
  Write-Host "Versão $Versao marcada localmente (commit e tag v$Versao). Envie com: git push origin main --follow-tags" -ForegroundColor Green
  exit 0
}
Rodar-Git push --quiet origin main --follow-tags
if (Get-Command gh -ErrorAction SilentlyContinue) {
  $notasRelease = (($Notas | ForEach-Object { "- $_" }) -join "`n")
  if ($Obrigatoria) { $notasRelease = "**Atualização obrigatória.**`n`n$notasRelease" }
  & gh release create "v$Versao" --repo LucasMinetto/magistrado --title "Magistrado $Versao" --notes $notasRelease | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Host 'Aviso: a tag foi enviada, mas a release no GitHub não foi criada.' -ForegroundColor Yellow }
}
Write-Host "Versão $Versao publicada. O Magistrado avisa na próxima verificação (ao abrir ou em Ajustes)." -ForegroundColor Green
