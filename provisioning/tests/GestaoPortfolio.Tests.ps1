#Requires -Version 7.4
<#
.SYNOPSIS
    Testes das funções auxiliares do provisionamento (não acessam o SharePoint).
    Execução: pwsh ./provisioning/tests/GestaoPortfolio.Tests.ps1
#>
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '../lib/GestaoPortfolio.psm1') -Force

$root = Join-Path $PSScriptRoot '..'
$config = Remove-JsonComments (Get-Content -Raw -Encoding utf8 (Join-Path $root 'gestao-portfolio.config.json') | ConvertFrom-Json -AsHashtable)
$methodology = Remove-JsonComments (Get-Content -Raw -Encoding utf8 (Join-Path $root 'metodologia.json') | ConvertFrom-Json -AsHashtable)

$failures = 0
$count = 0
function Assert([string] $Name, [scriptblock] $Condition) {
    $script:count++
    try {
        if (& $Condition) {
            Write-Host "  ok   $Name" -ForegroundColor Green
            return
        }
        Write-Host "  FAIL $Name" -ForegroundColor Red
    }
    catch {
        Write-Host "  FAIL $Name — $($_.Exception.Message)" -ForegroundColor Red
    }
    $script:failures++
}

# Avalia a parte aritmética de uma fórmula calculada substituindo [coluna] pelas notas.
function Invoke-Formula([string] $Formula, [hashtable] $DisplayNames, [hashtable] $Scores) {
    $expression = $Formula.Substring($Formula.IndexOf(',"",') + 4)
    $expression = $expression.Substring(0, $expression.Length - 1)
    foreach ($field in $DisplayNames.Keys) {
        $expression = $expression.Replace("[$($DisplayNames[$field])]", [string] $Scores[$field])
    }
    return [double] (Invoke-Expression $expression)
}

Write-Host 'Parâmetros da metodologia'
Assert 'metodologia.json é coerente' { (Test-MethodologyParameters $methodology).Count -eq 0 }
Assert 'aponta excesso de critérios de valor' {
    $copy = $methodology | ConvertTo-Json -Depth 20 | ConvertFrom-Json -AsHashtable
    $copy.valueCriteria += @(@{ field = 'NotaA'; label = 'A'; weight = 1 }, @{ field = 'NotaB'; label = 'B'; weight = 1 }, @{ field = 'NotaC'; label = 'C'; weight = 1 })
    (Test-MethodologyParameters $copy)[0] -like '*máximo recomendado é 8*'
}

Write-Host 'Colunas'
$scoreSpecs = Get-ScoreFieldSpecs $methodology
Assert 'uma coluna de nota por critério (10)' { $scoreSpecs.Count -eq 10 }
Assert 'nota com escala 1 a 5 e descrição dos extremos' { $scoreSpecs[0].min -eq 1 -and $scoreSpecs[0].max -eq 5 -and $scoreSpecs[0].description -like '*5 = Contribui diretamente*' }

$displayNames = @{}
$scoreSpecs | ForEach-Object { $displayNames[$_.internalName] = $_.displayName }
$indexSpecs = Get-IndexFieldSpecs $methodology $displayNames
$example = @{ NotaAlinhamento = 4; NotaValor = 5; NotaImpactoUsuarios = 3; NotaIndicadores = 4; NotaImpactoOrganizacional = 2; NotaUrgencia = 5; NotaEsforco = 3; NotaCusto = 2; NotaRisco = 4; NotaDependencias = 1 }
Assert 'fórmula do VP = Σ nota × peso ÷ 120 × 100' { [Math]::Abs((Invoke-Formula $indexSpecs[0].formula $displayNames $example) - 94 / 120 * 100) -lt 1e-9 }
Assert 'fórmula do CR = Σ nota × peso ÷ 60 × 100' { [Math]::Abs((Invoke-Formula $indexSpecs[1].formula $displayNames $example) - 32 / 60 * 100) -lt 1e-9 }
Assert 'fórmula do IPP = VP ÷ CR' { [Math]::Abs((Invoke-Formula $indexSpecs[2].formula $displayNames $example) - (94 / 120) / (32 / 60)) -lt 1e-9 }
Assert 'fórmulas ficam vazias com nota em branco' { $indexSpecs[2].formula.StartsWith('=IF(COUNT([Nota: Alinhamento estratégico],') -and $indexSpecs[2].formula.Contains(')<10,"",') }

$xml = [xml] (New-FieldSchemaXml $indexSpecs[2] @() '')
Assert 'XML da coluna calculada' { $xml.Field.Type -eq 'Calculated' -and $xml.Field.ResultType -eq 'Number' -and $xml.Field.FieldRefs.FieldRef.Count -eq 10 -and $xml.Field.Formula -eq $indexSpecs[2].formula }

$initiatives = $config.lists | Where-Object key -eq 'initiatives'
$status = $initiatives.fields | Where-Object internalName -eq 'Situacao'
$statusChoices = Resolve-FieldChoices $status $methodology $config
$xml = [xml] (New-FieldSchemaXml $status $statusChoices '')
Assert 'situação com as 16 opções do ciclo de vida, padrão "Registrada" e indexada' {
    $xml.Field.CHOICES.CHOICE.Count -eq 16 -and $xml.Field.Default -eq 'Registrada' -and $xml.Field.Indexed -eq 'TRUE' -and $xml.Field.Name -eq 'Situacao'
}
Assert 'objetivos estratégicos vêm de metodologia.json' {
    $field = $initiatives.fields | Where-Object internalName -eq 'ObjetivoEstrategico'
    (Resolve-FieldChoices $field $methodology $config) -join '|' -eq (($methodology.objectives | ForEach-Object name) -join '|')
}
Assert 'categorias e equipes vêm de metodologia.json' {
    $field = $initiatives.fields | Where-Object internalName -eq 'Horizonte'
    (Resolve-FieldChoices $field $methodology $config).Count -eq 3
}
Assert 'pesquisa múltipla aponta para a lista' {
    $field = $initiatives.fields | Where-Object internalName -eq 'Dependencias'
    $lookup = [xml] (New-FieldSchemaXml $field @() '11111111-2222-3333-4444-555555555555')
    $lookup.Field.Type -eq 'LookupMulti' -and $lookup.Field.Mult -eq 'TRUE' -and $lookup.Field.List -eq '{11111111-2222-3333-4444-555555555555}'
}
Assert 'colunas do modelo ficam fora dos formulários de inclusão e edição' {
    $field = $initiatives.fields | Where-Object internalName -eq 'Semaforo'
    $model = [xml] (New-FieldSchemaXml $field @('Verde', 'Amarelo', 'Vermelho') '')
    $model.Field.ShowInNewForm -eq 'FALSE' -and $model.Field.ShowInEditForm -eq 'FALSE'
}
Assert 'textos com caracteres especiais são escapados' {
    $field = @{ internalName = 'X'; type = 'Choice'; default = 'A & B' }
    ([xml] (New-FieldSchemaXml $field @('A & B', '<C>') '')).Field.CHOICES.CHOICE[1] -eq '<C>'
}
Assert 'todas as colunas configuradas geram XML válido' {
    foreach ($list in $config.lists) {
        foreach ($field in $list.fields) {
            $null = [xml] (New-FieldSchemaXml $field (Resolve-FieldChoices $field $methodology $config) '00000000-0000-0000-0000-000000000001')
        }
    }
    $true
}

Write-Host 'Atualização de colunas existentes'
$existing = '<Field Type="Choice" Name="Situacao"><CHOICES><CHOICE>Em análise</CHOICE><CHOICE>Planejada</CHOICE></CHOICES></Field>'
$merged = [xml] (Merge-ChoicesIntoSchema $existing @('Registrada', 'Em análise'))
Assert 'acrescenta opções que faltam e mantém as antigas' { ($merged.Field.CHOICES.CHOICE -join '|') -eq 'Em análise|Planejada|Registrada' }
Assert 'não altera quando todas as opções existem' { $null -eq (Merge-ChoicesIntoSchema $existing @('Planejada')) }
Assert 'atualiza a fórmula apenas quando muda' {
    $calc = '<Field Type="Calculated" Name="IPP"><Formula>=1</Formula></Field>'
    ($null -eq (Set-FormulaInSchema $calc '=1')) -and (([xml] (Set-FormulaInSchema $calc '=2')).Field.Formula -eq '=2')
}

Write-Host 'Exibições e formulário'
Assert 'consulta filtra por situação e ordena' {
    (New-ViewQuery @('Autorizada', 'Em andamento') 'Situacao' 'IPP' $false) -eq "<Where><In><FieldRef Name='Situacao' /><Values><Value Type='Choice'>Autorizada</Value><Value Type='Choice'>Em andamento</Value></Values></In></Where><OrderBy><FieldRef Name='IPP' Ascending='FALSE' /></OrderBy>"
}
Assert 'expande $scores e $indexes' { (Expand-FieldTokens @('Title', '$scores', '$indexes') @('A', 'B') @('IPP')) -join ',' -eq 'Title,A,B,IPP' }
Assert 'formulário em seções com nomes de exibição' {
    $json = New-FormFormatterJson @(@{ title = 'Avaliação'; fields = @('Title', '$scores') }) @{ Title = 'Iniciativa'; A = 'Nota A' } @('A') @()
    $outer = $json | ConvertFrom-Json
    $body = $outer.bodyJSONFormatter | ConvertFrom-Json
    $body.sections[0].displayname -eq 'Avaliação' -and ($body.sections[0].fields -join '|') -eq 'Iniciativa|Nota A'
}
Assert 'todas as colunas das seções e exibições existem' {
    $known = @('Title', 'LinkTitle', 'Created', 'Author', '$scores', '$indexes') + @($initiatives.fields | ForEach-Object internalName)
    $used = @($initiatives.formSections | ForEach-Object { $_.fields }) + @($initiatives.views | ForEach-Object { $_.fields }) + @($initiatives.defaultViewFields) + @('IPP')
    $unknown = @($used | Where-Object { $known -notcontains $_ -and $_ -ne 'IPP' })
    if ($unknown.Count -gt 0) { throw "Desconhecidas: $($unknown -join ', ')" }
    $true
}
Assert 'ciclo trimestral' { (Get-CycleName ([datetime] '2026-10-02')) -eq '2026-T4' -and (Get-CycleName ([datetime] '2027-03-31')) -eq '2027-T1' }

Write-Host 'Dados de exemplo'
$today = [datetime] '2026-10-02'
$sample = New-SampleData $config $methodology $today 'gestor@contoso.com'
$expected = 0
$config.sampleData.statuses.Values | ForEach-Object { $expected += $_ }
Assert "gera $expected iniciativas nas situações configuradas" { $sample.initiatives.Count -eq $expected }
Assert 'situações válidas' { @($sample.initiatives | Where-Object { $config.lifecycle.statuses -notcontains $_.Situacao }).Count -eq 0 }
Assert 'candidatas e ativas têm todas as notas; fila de entrada não' {
    $scored = @($sample.initiatives | Where-Object { @('Registrada', 'Em análise', 'Em detalhamento') -notcontains $_.Situacao })
    $unscored = @($sample.initiatives | Where-Object { $_.Situacao -eq 'Registrada' })
    @($scored | Where-Object { -not $_.Contains('NotaRisco') }).Count -eq 0 -and @($unscored | Where-Object { $_.Contains('NotaRisco') }).Count -eq 0
}
Assert 'notas dentro da escala' {
    $fields = @($methodology.valueCriteria + $methodology.costRiskCriteria | ForEach-Object field)
    @($sample.initiatives | ForEach-Object { $item = $_; $fields | Where-Object { $item.Contains($_) -and ($item[$_] -lt 1 -or $item[$_] -gt 5) } }).Count -eq 0
}
Assert 'ativas têm linha de base e decisão de autorização' {
    $active = @($sample.initiatives | Where-Object { @('Autorizada', 'Em andamento') -contains $_.Situacao })
    @($active | Where-Object { -not $_.Contains('TerminoPrevisto') -or -not $_.Contains('DataAutorizacao') }).Count -eq 0 -and
    @($sample.decisions | Where-Object decision -eq 'Aprovar integralmente').Count -ge $active.Count
}
Assert 'capacidade para o ciclo atual e o próximo, por equipe' { $sample.capacity.Count -eq 2 * $methodology.teams.Count -and $sample.capacity[0].Title -eq '2026-T4' }
Assert 'determinístico' { ((New-SampleData $config $methodology $today 'x').initiatives[5].EsforcoEstimado) -eq ((New-SampleData $config $methodology $today 'y').initiatives[5].EsforcoEstimado) }
Assert 'dependências referenciam iniciativas existentes' { @($sample.dependencies | Where-Object { $_.index -ge $sample.initiatives.Count -or $_.dependsOn[0] -ge $sample.initiatives.Count }).Count -eq 0 }

Write-Host ''
if ($failures -gt 0) {
    Write-Host "$failures de $count verificações falharam." -ForegroundColor Red
    exit 1
}
Write-Host "Todas as $count verificações passaram." -ForegroundColor Green
