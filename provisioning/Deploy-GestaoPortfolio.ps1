#Requires -Version 7.4
#Requires -Modules PnP.PowerShell

<#
.SYNOPSIS
    Implanta o layout "Gestão de Portfólio" (CIPP) em um site de comunicação do SharePoint Online.

.DESCRIPTION
    Etapas executadas (cada uma pode ser ignorada por parâmetro):
      1. Publica o pacote SPFx (cipp-portfolio.sppkg) no catálogo de aplicativos.
      2. Registra o tema da CIPP no tenant e aplica ao site.
      3. Configura título, cabeçalho, megamenu, navegação e rodapé do site.
      4. Cria a lista "Iniciativas" usada pelo painel de indicadores (e, opcionalmente, dados de exemplo).
      5. Envia as imagens da pasta assets/ para SiteAssets/gestao-portfolio.
      6. Cria (ou recria) a página Gestao-de-Portfolio.aspx com as seções do layout e a publica.

    Todo o conteúdo vem de gestao-portfolio.config.json. O script pode ser executado várias vezes:
    a página é limpa e montada novamente, a lista e as colunas existentes são mantidas.

.PARAMETER SiteUrl
    URL do site de comunicação. Ex.: https://contoso.sharepoint.com/sites/cipp

.PARAMETER ClientId
    ID do aplicativo Entra ID usado pelo PnP.PowerShell (veja Register-PnPEntraIDAppForInteractiveLogin).

.PARAMETER AdminUrl
    URL do centro de administração do SharePoint. Por padrão é derivada de SiteUrl (contoso-admin.sharepoint.com).

.PARAMETER PackagePath
    Caminho do .sppkg. Por padrão: ../spfx/sharepoint/solution/cipp-portfolio.sppkg

.PARAMETER AppCatalogScope
    Tenant (padrão) publica o pacote no catálogo do tenant; Site usa o catálogo do próprio site.

.EXAMPLE
    ./Deploy-GestaoPortfolio.ps1 -SiteUrl https://contoso.sharepoint.com/sites/cipp -ClientId 00000000-0000-0000-0000-000000000000

.EXAMPLE
    # Sem permissão de administrador do tenant: pacote já publicado pelo administrador e tema aplicado manualmente.
    ./Deploy-GestaoPortfolio.ps1 -SiteUrl https://contoso.sharepoint.com/sites/cipp -ClientId <id> -SkipApp -SkipTheme
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^https://[^/]+\.sharepoint\.com/')]
    [string] $SiteUrl,

    [Parameter(Mandatory)]
    [string] $ClientId,

    [string] $AdminUrl,

    [string] $ConfigPath = (Join-Path $PSScriptRoot 'gestao-portfolio.config.json'),

    [string] $PackagePath = (Join-Path $PSScriptRoot '../spfx/sharepoint/solution/cipp-portfolio.sppkg'),

    [ValidateSet('Tenant', 'Site')]
    [string] $AppCatalogScope = 'Tenant',

    [switch] $SkipApp,
    [switch] $SkipTheme,
    [switch] $SkipNavigation,
    [switch] $SkipList,
    [switch] $SkipPage,
    [switch] $SeedSampleData
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$SiteUrl = $SiteUrl.TrimEnd('/')
if (-not $AdminUrl) {
    $siteUri = [Uri] $SiteUrl
    $tenant = $siteUri.Host.Split('.')[0]
    $AdminUrl = "https://$tenant-admin.sharepoint.com"
}

$config = Get-Content -Raw -Encoding utf8 -Path $ConfigPath | ConvertFrom-Json -AsHashtable
$assetsFolder = 'SiteAssets/gestao-portfolio'
$localAssets = Join-Path $PSScriptRoot 'assets'

function Write-Step([string] $Message) {
    Write-Host ''
    Write-Host "==> $Message" -ForegroundColor Cyan
}

# ---------------------------------------------------------------------------
# Conexões
# ---------------------------------------------------------------------------
Write-Step "Conectando em $SiteUrl"
$site = Connect-PnPOnline -Url $SiteUrl -Interactive -ClientId $ClientId -ReturnConnection
$web = Get-PnPWeb -Includes ServerRelativeUrl, WebTemplate -Connection $site
$siteRelativeUrl = $web.ServerRelativeUrl.TrimEnd('/')

if ($web.WebTemplate -ne 'SITEPAGEPUBLISHING') {
    Write-Warning "O site não é um site de comunicação (modelo atual: $($web.WebTemplate)). As seções de largura total só existem em sites de comunicação."
}

$admin = $null
if (-not $SkipTheme) {
    Write-Step "Conectando no centro de administração ($AdminUrl) para registrar o tema"
    $admin = Connect-PnPOnline -Url $AdminUrl -Interactive -ClientId $ClientId -ReturnConnection
}

# ---------------------------------------------------------------------------
# Tokens: {site} e {asset:arquivo}
# ---------------------------------------------------------------------------
$uploadedAssets = @{}

function Get-AssetUrl([string] $FileName) {
    if ($uploadedAssets.ContainsKey($FileName)) {
        return $uploadedAssets[$FileName]
    }

    $localFile = Join-Path $localAssets $FileName
    if (-not (Test-Path $localFile)) {
        Write-Warning "Imagem '$FileName' não encontrada em assets/. A propriedade ficará vazia (a web part usa o visual padrão)."
        $uploadedAssets[$FileName] = ''
        return ''
    }

    # Garante a biblioteca "Ativos do Site" (SiteAssets), criada sob demanda pelo SharePoint.
    $context = $site.Context
    $library = $context.Web.Lists.EnsureSiteAssetsLibrary()
    $context.Load($library)
    $context.ExecuteQuery()

    $null = Add-PnPFile -Path $localFile -Folder $assetsFolder -Connection $site
    $url = "$siteRelativeUrl/$assetsFolder/$FileName"
    Write-Host "    imagem enviada: $url"
    $uploadedAssets[$FileName] = $url
    return $url
}

function Resolve-Tokens($Value) {
    if ($null -eq $Value) {
        return $null
    }
    if ($Value -is [string]) {
        $resolved = [regex]::Replace($Value, '\{asset:([^}]+)\}', { param($m) Get-AssetUrl $m.Groups[1].Value })
        return $resolved.Replace('{site}', $siteRelativeUrl)
    }
    if ($Value -is [System.Collections.IDictionary]) {
        $copy = [ordered]@{}
        foreach ($key in $Value.Keys) {
            if (-not "$key".StartsWith('$')) {
                $copy[$key] = Resolve-Tokens $Value[$key]
            }
        }
        return $copy
    }
    if ($Value -is [System.Collections.IList]) {
        return , @($Value | ForEach-Object { Resolve-Tokens $_ })
    }
    return $Value
}

function Resolve-NodeUrl([string] $Url) {
    $resolved = Resolve-Tokens $Url
    # No site raiz do tenant, {site} é vazio.
    if ([string]::IsNullOrEmpty($resolved)) { '/' } else { $resolved }
}

# ---------------------------------------------------------------------------
# 1. Pacote SPFx
# ---------------------------------------------------------------------------
if (-not $SkipApp) {
    Write-Step "Publicando o pacote SPFx ($AppCatalogScope)"
    if (-not (Test-Path $PackagePath)) {
        throw "Pacote não encontrado em '$PackagePath'. Gere-o com 'npm run build' na pasta spfx/ ou informe -PackagePath."
    }

    $app = Add-PnPApp -Path $PackagePath -Scope $AppCatalogScope -Publish -SkipFeatureDeployment -Overwrite -Connection $site
    if ($AppCatalogScope -eq 'Site') {
        try {
            Install-PnPApp -Identity $app.Id -Scope Site -Connection $site
        }
        catch {
            Write-Host '    aplicativo já instalado no site; mantendo a versão publicada.'
        }
    }
    Write-Host "    pacote publicado: $($app.Title) ($($app.Id))"
}

# ---------------------------------------------------------------------------
# 2. Tema
# ---------------------------------------------------------------------------
if (-not $SkipTheme) {
    Write-Step 'Aplicando o tema'
    $theme = Get-Content -Raw -Encoding utf8 -Path (Join-Path $PSScriptRoot $config.theme.file) | ConvertFrom-Json -AsHashtable
    $palette = @{}
    foreach ($key in $theme.palette.Keys) {
        $palette[$key] = $theme.palette[$key]
    }
    Add-PnPTenantTheme -Identity $theme.name -Palette $palette -IsInverted $theme.isInverted -Overwrite -Connection $admin
    Set-PnPWebTheme -Theme $theme.name -WebUrl $SiteUrl -Connection $admin
    Write-Host "    tema '$($theme.name)' aplicado."
}

# ---------------------------------------------------------------------------
# 3. Título, cabeçalho, navegação e rodapé
# ---------------------------------------------------------------------------
if (-not $SkipNavigation) {
    Write-Step 'Configurando cabeçalho, navegação e rodapé'

    if ($config.site.title) {
        Set-PnPWeb -Title $config.site.title -Description $config.site.description -Connection $site
    }

    $header = $config.header
    $headerArgs = @{
        HeaderLayout   = $header.layout
        HeaderEmphasis = $header.emphasis
        LogoAlignment  = $header.logoAlignment
        Connection     = $site
    }
    $logoUrl = Resolve-Tokens $header.logo
    if ($logoUrl) {
        $headerArgs.SiteLogoUrl = $logoUrl
    }
    Set-PnPWebHeader @headerArgs
    Set-PnPWeb -MegaMenuEnabled:([bool] $header.megaMenu) -Connection $site

    Set-PnPFooter -Enabled:([bool] $config.footer.enabled) -Connection $site

    $navigation = $config.navigation
    $location = $navigation.location
    if ($navigation.replaceExisting) {
        Get-PnPNavigationNode -Location $location -Connection $site | ForEach-Object {
            Remove-PnPNavigationNode -Identity $_.Id -Force -Connection $site
        }
    }

    # Os nós são acrescentados ao final, na ordem do arquivo de configuração.
    foreach ($node in $navigation.nodes) {
        $parent = Add-PnPNavigationNode -Location $location -Title $node.title -Url (Resolve-NodeUrl $node.url) -Connection $site
        foreach ($child in @($node['children'] | Where-Object { $_ })) {
            $null = Add-PnPNavigationNode -Location $location -Title $child.title -Url (Resolve-NodeUrl $child.url) -Parent $parent.Id -Connection $site
        }
    }
    Write-Host "    $(@($navigation.nodes).Count) itens de navegação criados."
}

# ---------------------------------------------------------------------------
# 4. Lista de iniciativas
# ---------------------------------------------------------------------------
if (-not $SkipList) {
    $listConfig = $config.list
    Write-Step "Garantindo a lista '$($listConfig.title)'"

    $list = Get-PnPList -Identity $listConfig.url -Connection $site -ErrorAction SilentlyContinue
    if (-not $list) {
        $list = New-PnPList -Title $listConfig.title -Url $listConfig.url -Template GenericList -Connection $site
        Write-Host '    lista criada.'
    }
    if ($listConfig.titleFieldDisplayName) {
        $null = Set-PnPField -List $list -Identity 'Title' -Values @{ Title = $listConfig.titleFieldDisplayName } -Connection $site
    }

    foreach ($field in $listConfig.fields) {
        $existing = Get-PnPField -List $list -Identity $field.internalName -Connection $site -ErrorAction SilentlyContinue
        if ($existing) {
            Write-Host "    coluna já existe, mantida como está: $($field.internalName)"
            continue
        }

        $fieldArgs = @{
            List            = $list
            DisplayName     = $field.displayName
            InternalName    = $field.internalName
            Type            = $field.type
            AddToDefaultView = $true
            Required        = [bool] $field['required']
            Connection      = $site
        }
        if ($field.type -eq 'Choice') {
            $fieldArgs.Choices = [string[]] $field.choices
        }
        $null = Add-PnPField @fieldArgs
        if ($field['default']) {
            $null = Set-PnPField -List $list -Identity $field.internalName -Values @{ DefaultValue = $field.default } -Connection $site
        }
        Write-Host "    coluna criada: $($field.displayName) ($($field.internalName))"
    }

    if ($SeedSampleData) {
        Write-Step 'Inserindo iniciativas de exemplo'
        $objectives = @(($listConfig.fields | Where-Object { $_.internalName -eq 'ObjetivoEstrategico' }).choices)
        # Distribuição decrescente entre os objetivos, como no gráfico do layout.
        $weights = @(5, 4, 3, 2, 2)
        $objectivePool = @()
        for ($i = 0; $i -lt $objectives.Count; $i++) {
            $objectivePool += @($objectives[$i]) * $weights[[Math]::Min($i, $weights.Count - 1)]
        }

        $index = 0
        foreach ($status in $listConfig.sampleData.statuses.Keys) {
            for ($n = 1; $n -le $listConfig.sampleData.statuses[$status]; $n++) {
                $index++
                $values = @{
                    Title               = "Iniciativa de exemplo $index"
                    Situacao            = $status
                    ObjetivoEstrategico = $objectivePool[$index % $objectivePool.Count]
                    UnidadeDemandante   = 'CIPP'
                }
                $null = Add-PnPListItem -List $list -Values $values -Connection $site
            }
        }
        Write-Host "    $index itens inseridos."
    }
}

# ---------------------------------------------------------------------------
# 5 e 6. Página
# ---------------------------------------------------------------------------
if (-not $SkipPage) {
    $pageConfig = $config.page
    $pageName = $pageConfig.name
    Write-Step "Montando a página $pageName.aspx"

    $page = $null
    try {
        $page = Get-PnPPage -Identity $pageName -Connection $site
    }
    catch {
        $page = $null
    }

    if ($page) {
        $page.ClearPage()
        $null = $page.Save()
        Write-Host '    página existente limpa.'
    }
    else {
        $null = Add-PnPPage -Name $pageName -LayoutType Home -Connection $site
        Write-Host '    página criada.'
    }

    # Logo após publicar o pacote, as web parts podem levar alguns minutos para aparecer no site.
    $required = @($pageConfig.sections | ForEach-Object { "$($_.webPart)".ToLowerInvariant() })
    for ($attempt = 1; ; $attempt++) {
        $available = @(Get-PnPPageComponent -Page $pageName -ListAvailable -Connection $site |
            ForEach-Object { "$($_.Id)".Trim('{', '}').ToLowerInvariant() })
        $missing = @($required | Where-Object { $available -notcontains $_ })
        if ($missing.Count -eq 0) {
            break
        }
        if ($attempt -ge 20) {
            throw "Web parts indisponíveis no site: $($missing -join ', '). Verifique se o pacote cipp-portfolio.sppkg foi publicado (e instalado, se o catálogo for do site)."
        }
        Write-Host "    aguardando as web parts ficarem disponíveis ($attempt/20)..."
        Start-Sleep -Seconds 15
    }

    $order = 0
    foreach ($section in $pageConfig.sections) {
        $order++
        Add-PnPPageSection -Page $pageName -SectionTemplate OneColumnFullWidth -Order $order -Connection $site

        $webPartArgs = @{
            Page       = $pageName
            Component  = $section.webPart
            Section    = $order
            Column     = 1
            Connection = $site
        }
        if ($section['properties']) {
            $webPartArgs.WebPartProperties = (Resolve-Tokens $section.properties) | ConvertTo-Json -Depth 20 -Compress
        }
        $null = Add-PnPPageWebPart @webPartArgs
        Write-Host "    seção $order`: $($section['$comment'])"
    }

    Set-PnPPage -Identity $pageName -Title $pageConfig.title -CommentsEnabled:$false -Publish -Connection $site
    if ($pageConfig.setAsHomePage) {
        Set-PnPHomePage -RootFolderRelativeUrl "SitePages/$pageName.aspx" -Connection $site
        Write-Host '    definida como página inicial do site.'
    }
}

Write-Step 'Concluído'
Write-Host "Página: $SiteUrl/SitePages/$($config.page.name).aspx" -ForegroundColor Green
