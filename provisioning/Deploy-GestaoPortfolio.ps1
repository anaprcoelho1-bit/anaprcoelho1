#Requires -Version 7.4
#Requires -Modules PnP.PowerShell

<#
.SYNOPSIS
    Implanta a Gestão de Portfólio (CIPP) em um site de comunicação do SharePoint Online: o layout
    institucional e a automação da Metodologia de Gestão de Portfólio.

.DESCRIPTION
    Etapas executadas (cada uma pode ser ignorada por parâmetro):
      1. Publica o pacote SPFx (cipp-portfolio.sppkg) no catálogo de aplicativos.
      2. Registra o tema da CIPP no tenant e aplica ao site.
      3. Configura título, cabeçalho, megamenu, navegação e rodapé do site.
      4. Publica os parâmetros da metodologia (metodologia.json) e cria as listas da metodologia:
         Iniciativas (inventário e ficha), Registro de Decisões, Mapa de Capacidade e Pontuações do Comitê,
         com as colunas de notas e as colunas calculadas VP, CR e IPP geradas a partir dos pesos,
         exibições (fila de entrada, matriz de priorização, portfólio ativo, encerradas) e formulário em seções.
         Opcionalmente, insere dados de exemplo.
      5. Envia as imagens e documentos da pasta assets/ para SiteAssets/gestao-portfolio.
      6. Cria (ou recria) as páginas: Gestão de Portfólio (layout) e as páginas operacionais de
         Priorização, Seleção e balanceamento, Monitoramento e Relatório executivo.

    O conteúdo vem de gestao-portfolio.config.json e metodologia.json. O script pode ser executado várias vezes:
    as páginas são limpas e montadas novamente; listas e colunas existentes são mantidas (opções de escolha
    que faltarem são acrescentadas e as fórmulas de VP, CR e IPP são atualizadas com os pesos vigentes).

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

.EXAMPLE
    # Revisão anual dos pesos (seção 5.6): atualiza metodologia.json publicado e as fórmulas das colunas calculadas.
    ./Deploy-GestaoPortfolio.ps1 -SiteUrl https://contoso.sharepoint.com/sites/cipp -ClientId <id> -SkipApp -SkipTheme -SkipNavigation -SkipPage
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

    [string] $MethodologyPath,

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

Import-Module (Join-Path $PSScriptRoot 'lib/GestaoPortfolio.psm1') -Force

$config = Get-Content -Raw -Encoding utf8 -Path $ConfigPath | ConvertFrom-Json -AsHashtable
if (-not $MethodologyPath) {
    $MethodologyPath = Join-Path $PSScriptRoot $config.methodology.file
}
$methodology = Remove-JsonComments (Get-Content -Raw -Encoding utf8 -Path $MethodologyPath | ConvertFrom-Json -AsHashtable)
$problems = Test-MethodologyParameters $methodology
if ($problems.Count -gt 0) {
    throw "Parâmetros inválidos em $MethodologyPath`n - $($problems -join "`n - ")"
}
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
$siteAssetsReady = $false

function Initialize-SiteAssets {
    # Garante a biblioteca "Ativos do Site" (SiteAssets), criada sob demanda pelo SharePoint.
    if ($script:siteAssetsReady) {
        return
    }
    $context = $site.Context
    $library = $context.Web.Lists.EnsureSiteAssetsLibrary()
    $context.Load($library)
    $context.ExecuteQuery()
    $script:siteAssetsReady = $true
}

function Get-AssetUrl([string] $FileName) {
    if ($uploadedAssets.ContainsKey($FileName)) {
        return $uploadedAssets[$FileName]
    }

    $localFile = Join-Path $localAssets $FileName
    if (-not (Test-Path $localFile)) {
        Write-Warning "Arquivo '$FileName' não encontrado em assets/. A propriedade ficará vazia (a web part usa o visual padrão)."
        $uploadedAssets[$FileName] = ''
        return ''
    }

    Initialize-SiteAssets
    $null = Add-PnPFile -Path $localFile -Folder $assetsFolder -Connection $site
    $url = "$siteRelativeUrl/$assetsFolder/$FileName"
    Write-Host "    arquivo enviado: $url"
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
# 4. Parâmetros da metodologia e listas
# ---------------------------------------------------------------------------
function Get-FieldTitle($List, [string] $InternalName) {
    $field = Get-PnPField -List $List -Identity $InternalName -Connection $site -ErrorAction SilentlyContinue
    if ($field) { $field.Title } else { $null }
}

function Set-ListField($List, $Field, [string[]] $Choices) {
    <# Cria a coluna (ou atualiza opções/fórmula da existente) e retorna o nome de exibição atual. #>
    $name = $Field.internalName
    $existing = Get-PnPField -List $List -Identity $name -Connection $site -ErrorAction SilentlyContinue
    if ($existing) {
        $schema = Get-PnPProperty -ClientObject $existing -Property SchemaXml -Connection $site
        $updated = $null
        if ($Field.type -in 'Choice', 'MultiChoice' -and $Choices.Count -gt 0) {
            $updated = Merge-ChoicesIntoSchema $schema $Choices
        }
        elseif ($Field.type -eq 'Calculated') {
            $updated = Set-FormulaInSchema $schema $Field.formula
        }
        if ($updated) {
            $null = Set-PnPField -List $List -Identity $name -Values @{ SchemaXml = $updated } -Connection $site
            Write-Host "    coluna atualizada: $($existing.Title) ($name)"
        }
        else {
            Write-Host "    coluna mantida: $($existing.Title) ($name)"
        }
        return $existing.Title
    }

    $lookupId = $null
    if ($Field.type -in 'Lookup', 'LookupMulti') {
        $target = Get-PnPList -Identity $Field.lookupList -Connection $site -ErrorAction SilentlyContinue
        if (-not $target) {
            throw "A lista '$($Field.lookupList)' usada pela coluna $name não existe. Verifique a ordem das listas na configuração."
        }
        $lookupId = $target.Id.ToString()
    }
    $null = Add-PnPFieldFromXml -List $List -FieldXml (New-FieldSchemaXml $Field $Choices $lookupId) -Connection $site
    $values = @{ Title = $Field.displayName }
    if ($Field.Contains('description') -and $Field.description) {
        $values.Description = $Field.description
    }
    $null = Set-PnPField -List $List -Identity $name -Values $values -Connection $site
    Write-Host "    coluna criada: $($Field.displayName) ($name)"
    return $Field.displayName
}

function Set-ListView($List, [string] $Title, [string[]] $Fields, [string] $Query, [switch] $Default) {
    $view = if ($Default) {
        Get-PnPView -List $List -Connection $site | Where-Object DefaultView | Select-Object -First 1
    }
    else {
        Get-PnPView -List $List -Identity $Title -Connection $site -ErrorAction SilentlyContinue
    }
    if ($view) {
        $values = @{}
        if ($Query) { $values.ViewQuery = $Query }
        $null = Set-PnPView -List $List -Identity $view.Id -Fields $Fields -Values $values -Connection $site
        Write-Host "    exibição atualizada: $($view.Title)"
    }
    else {
        $null = Add-PnPView -List $List -Title $Title -Fields $Fields -Query $Query -RowLimit 100 -Paged -Connection $site
        Write-Host "    exibição criada: $Title"
    }
}

function ConvertTo-Hashtable($Values) {
    $table = @{}
    foreach ($key in $Values.Keys) { $table[$key] = $Values[$key] }
    return $table
}

$listUrls = @{}
$scoreNames = [string[]] @($methodology.valueCriteria + $methodology.costRiskCriteria | ForEach-Object { $_.field })
$indexNames = [string[]] @('ValorPonderado', 'CustoRiscoPonderado', 'IPP')

if (-not $SkipList) {
    Write-Step "Publicando os parâmetros da metodologia (v$($methodology.version))"
    Initialize-SiteAssets
    $null = Add-PnPFile -Path $MethodologyPath -Folder $config.methodology.publishFolder -NewFileName 'metodologia.json' -Connection $site
    Write-Host "    $siteRelativeUrl/$($config.methodology.publishFolder)/metodologia.json"

    foreach ($listConfig in $config.lists) {
        $listUrls[$listConfig.key] = $listConfig.url
        Write-Step "Garantindo a lista '$($listConfig.title)'"

        $list = Get-PnPList -Identity $listConfig.url -Connection $site -ErrorAction SilentlyContinue
        if (-not $list) {
            $list = New-PnPList -Title $listConfig.title -Url $listConfig.url -Template GenericList -Connection $site
            Write-Host '    lista criada.'
            if ($listConfig['description']) {
                try {
                    Set-PnPList -Identity $list -Description $listConfig.description -Connection $site
                }
                catch {
                    Write-Verbose "Descrição da lista não aplicada: $_"
                }
            }
        }

        $titleValues = @{ Title = $listConfig.titleFieldDisplayName }
        if ($listConfig.Contains('titleFieldRequired')) { $titleValues.Required = [bool] $listConfig.titleFieldRequired }
        if ($listConfig['titleFieldDescription']) { $titleValues.Description = $listConfig.titleFieldDescription }
        $null = Set-PnPField -List $list -Identity 'Title' -Values $titleValues -Connection $site

        $displayNames = @{ Title = $listConfig.titleFieldDisplayName; LinkTitle = $listConfig.titleFieldDisplayName }
        foreach ($field in $listConfig.fields) {
            $displayNames[$field.internalName] = Set-ListField $list $field (Resolve-FieldChoices $field $methodology $config)
        }
        if ($listConfig['scoreFields']) {
            $scoreSpecs = Get-ScoreFieldSpecs $methodology
            foreach ($field in $scoreSpecs) {
                $displayNames[$field.internalName] = Set-ListField $list $field @()
            }
        }
        if ($listConfig['indexFields']) {
            $indexSpecs = Get-IndexFieldSpecs $methodology $displayNames
            foreach ($field in $indexSpecs) {
                $displayNames[$field.internalName] = Set-ListField $list $field @()
            }
        }

        foreach ($field in @($listConfig.fields | Where-Object { $_['format'] })) {
            $formatJson = $config.formats[$field.format] | ConvertTo-Json -Depth 20 -Compress
            $null = Set-PnPField -List $list -Identity $field.internalName -Values @{ CustomFormatter = $formatJson } -Connection $site
        }

        foreach ($view in @($listConfig['views'] | Where-Object { $_ })) {
            $fields = Expand-FieldTokens ([string[]] $view.fields) $scoreNames $indexNames
            $query = New-ViewQuery ([string[]] $view.statuses) 'Situacao' $view.orderBy ([bool] $view.ascending)
            Set-ListView $list $view.title $fields $query
        }
        if ($listConfig['defaultViewFields']) {
            $fields = Expand-FieldTokens ([string[]] $listConfig.defaultViewFields) $scoreNames $indexNames
            $query = if ($listConfig['defaultViewOrderBy']) { New-ViewQuery @() '' $listConfig.defaultViewOrderBy ([bool] $listConfig['defaultViewAscending']) } else { '' }
            Set-ListView $list '' $fields $query -Default
        }

        if ($listConfig['formSections']) {
            $contentType = Get-PnPContentType -List $list -Connection $site |
                Where-Object { -not $_.Hidden -and -not $_.StringId.StartsWith('0x0120') } | Select-Object -First 1
            if ($contentType) {
                $contentType.ClientFormCustomFormatter = New-FormFormatterJson $listConfig.formSections $displayNames $scoreNames $indexNames
                $contentType.Update($false)
                Invoke-PnPQuery -Connection $site
                Write-Host "    formulário organizado em $(@($listConfig.formSections).Count) seções."
            }
        }
    }

    if ($SeedSampleData) {
        Write-Step 'Inserindo dados de exemplo'
        $web = Get-PnPWeb -Includes CurrentUser -Connection $site
        $owner = if ($web.CurrentUser.Email) { $web.CurrentUser.Email } else { $web.CurrentUser.LoginName }
        $sample = New-SampleData $config $methodology (Get-Date).Date $owner

        $ids = @()
        foreach ($item in $sample.initiatives) {
            $created = Add-PnPListItem -List $listUrls.initiatives -Values (ConvertTo-Hashtable $item) -Connection $site
            $ids += $created.Id
        }
        foreach ($dependency in $sample.dependencies) {
            $null = Set-PnPListItem -List $listUrls.initiatives -Identity $ids[$dependency.index] -Values @{ Dependencias = @($dependency.dependsOn | ForEach-Object { $ids[$_] }) } -Connection $site
        }
        foreach ($row in $sample.capacity) {
            $null = Add-PnPListItem -List $listUrls.capacity -Values (ConvertTo-Hashtable $row) -Connection $site
        }
        foreach ($decision in $sample.decisions) {
            $initiative = $sample.initiatives[$decision.index]
            $null = Add-PnPListItem -List $listUrls.decisions -Connection $site -Values @{
                Title            = "$($decision.decision) – $($initiative.Title)"
                Iniciativa       = $ids[$decision.index]
                PontoDecisao     = $decision.point
                Decisao          = $decision.decision
                Justificativa    = $decision.justification
                Instancia        = $decision.body
                DataDecisao      = $decision.date
                SituacaoAnterior = $decision.previous
                SituacaoNova     = $decision.new
            }
        }
        Write-Host "    $($ids.Count) iniciativas, $($sample.capacity.Count) linhas de capacidade e $($sample.decisions.Count) decisões inseridas."
        Write-Host '    Abra a página de Monitoramento e use "Atualizar lista" para gravar códigos, ranking, semáforo e alertas.'
    }
}

# ---------------------------------------------------------------------------
# 5 e 6. Páginas
# ---------------------------------------------------------------------------
if (-not $SkipPage) {
    $pages = @($config.pages)

    # Logo após publicar o pacote, as web parts podem levar alguns minutos para aparecer no site.
    $firstPage = $pages[0].name
    $existingFirst = $null
    try { $existingFirst = Get-PnPPage -Identity $firstPage -Connection $site } catch { $existingFirst = $null }
    if (-not $existingFirst) {
        $null = Add-PnPPage -Name $firstPage -LayoutType Home -Connection $site
    }
    $required = @($pages | ForEach-Object { $_.sections } | ForEach-Object { "$($_.webPart)".ToLowerInvariant() } | Select-Object -Unique)
    for ($attempt = 1; ; $attempt++) {
        $available = @(Get-PnPPageComponent -Page $firstPage -ListAvailable -Connection $site |
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

    foreach ($pageConfig in $pages) {
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
        if ($pageConfig['setAsHomePage']) {
            Set-PnPHomePage -RootFolderRelativeUrl "SitePages/$pageName.aspx" -Connection $site
            Write-Host '    definida como página inicial do site.'
        }
    }
}

Write-Step 'Concluído'
foreach ($pageConfig in $config.pages) {
    Write-Host "Página: $SiteUrl/SitePages/$($pageConfig.name).aspx" -ForegroundColor Green
}
