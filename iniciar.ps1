# Abre o backend e o frontend do Cérebro, cada um na sua janela do PowerShell, e o app no navegador.
# Uso, na raiz do projeto, depois da primeira instalação (passos 2 e 3 do INICIAR-NO-VSCODE.md):
#   .\iniciar.ps1
# Se o PowerShell bloquear scripts: powershell -ExecutionPolicy Bypass -File .\iniciar.ps1
$raiz = $PSScriptRoot
$python = Join-Path $raiz 'backend\.venv\Scripts\python.exe'

if (-not (Test-Path $python)) {
    Write-Host 'Falta o ambiente do backend. Siga o passo 2 do INICIAR-NO-VSCODE.md (python -m venv .venv e pip install).'
    exit 1
}
if (-not (Test-Path (Join-Path $raiz 'frontend\node_modules'))) {
    Write-Host 'Falta instalar o frontend. Rode "npm ci" na pasta frontend (passo 3 do INICIAR-NO-VSCODE.md).'
    exit 1
}
# Pacote que entrou no package.json depois da instalação (o da fonte, por exemplo): sem ele o app abre sem avisar o que falta.
$pacotes = (Get-Content (Join-Path $raiz 'frontend\package.json') -Raw -Encoding UTF8 | ConvertFrom-Json).dependencies.PSObject.Properties.Name
$faltam = @($pacotes | Where-Object { -not (Test-Path (Join-Path $raiz "frontend\node_modules\$_")) })
if ($faltam) {
    Write-Host ('Falta instalar no frontend: ' + ($faltam -join ', ') + '. Feche a janela do frontend, se estiver aberta, e rode "npm ci" na pasta frontend.')
    exit 1
}

function Test-PortaOcupada($porta) {
    [bool](Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue)
}

if (Test-PortaOcupada 8000) {
    Write-Host 'A porta 8000 já está em uso: o backend já deve estar rodando. Não abri outro.'
} else {
    $backend = "Set-Location '$raiz\backend'; & '$python' -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
    Start-Process powershell -ArgumentList '-NoExit', '-Command', $backend
}

if (Test-PortaOcupada 5173) {
    Write-Host 'A porta 5173 já está em uso: o frontend já deve estar rodando. Não abri outro.'
} else {
    $frontend = "Set-Location '$raiz\frontend'; npm.cmd run dev"
    Start-Process powershell -ArgumentList '-NoExit', '-Command', $frontend
}

# O site de apresentação, quando existir o export estático em landing\out.
$site = Join-Path $raiz 'landing\out'
if (Test-Path $site) {
    if (Test-PortaOcupada 4321) {
        Write-Host 'A porta 4321 já está em uso: o site já deve estar rodando. Não abri outro.'
    } else {
        # Serve só a pasta do site exportado, nunca a raiz do projeto, onde fica o .env.
        $servidor = "& '$python' -m http.server 4321 --bind 127.0.0.1 --directory '$site'"
        Start-Process powershell -ArgumentList '-NoExit', '-Command', $servidor
    }
    Write-Host 'Site de apresentação em http://127.0.0.1:4321.'
}

# O Vite leva um ou dois segundos para responder.
Start-Sleep -Seconds 3
Start-Process 'http://localhost:5173'
Write-Host 'Backend em http://127.0.0.1:8000 e app em http://localhost:5173. Para parar, feche as janelas abertas.'
