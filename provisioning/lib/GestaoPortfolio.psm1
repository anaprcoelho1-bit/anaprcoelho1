# Funções auxiliares (sem acesso ao SharePoint) usadas por Deploy-GestaoPortfolio.ps1.
# Geram o XML das colunas, as fórmulas de VP/CR/IPP, as consultas das exibições, a formatação do
# formulário e os dados de exemplo a partir de gestao-portfolio.config.json e metodologia.json.
# Testes: provisioning/tests/GestaoPortfolio.Tests.ps1

Set-StrictMode -Version Latest

$script:IndexFields = @(
    @{ internalName = 'ValorPonderado'; displayName = 'VP – Valor Ponderado'; set = 'valueCriteria' }
    @{ internalName = 'CustoRiscoPonderado'; displayName = 'CR – Custo-Risco Ponderado'; set = 'costRiskCriteria' }
    @{ internalName = 'IPP'; displayName = 'IPP – Índice de Prioridade'; set = $null }
)

function Remove-JsonComments($Value) {
    <# Remove as chaves iniciadas por "$" (comentários) de um objeto lido com ConvertFrom-Json -AsHashtable. #>
    if ($Value -is [System.Collections.IDictionary]) {
        $copy = [ordered]@{}
        foreach ($key in $Value.Keys) {
            if (-not "$key".StartsWith('$')) {
                $copy[$key] = Remove-JsonComments $Value[$key]
            }
        }
        return $copy
    }
    if ($Value -is [System.Collections.IList]) {
        return , @($Value | ForEach-Object { Remove-JsonComments $_ })
    }
    return $Value
}

function Test-MethodologyParameters($Methodology) {
    <# Regras da seção 5.6. Retorna a lista de problemas (vazia se estiver tudo certo). #>
    $problems = [System.Collections.Generic.List[string]]::new()
    $value = @($Methodology.valueCriteria)
    $cost = @($Methodology.costRiskCriteria)
    if ($value.Count -eq 0 -or $cost.Count -eq 0) {
        $problems.Add('É necessário ao menos um critério de valor e um de custo, esforço e risco.')
    }
    if ($value.Count -gt $Methodology.maxValueCriteria) {
        $problems.Add("Há $($value.Count) critérios de valor; o máximo recomendado é $($Methodology.maxValueCriteria).")
    }
    $fields = @($value + $cost | ForEach-Object { $_.field })
    $duplicates = @($fields | Group-Object | Where-Object Count -gt 1 | ForEach-Object Name)
    foreach ($name in $duplicates) {
        $problems.Add("A coluna $name está repetida em mais de um critério.")
    }
    foreach ($criterion in $value + $cost) {
        if ($criterion.field -notmatch '^[A-Za-z][A-Za-z0-9]{0,31}$') {
            $problems.Add("Nome interno inválido para a coluna do critério '$($criterion.label)': $($criterion.field) (use apenas letras e números).")
        }
        if (-not ($criterion.weight -gt 0)) {
            $problems.Add("O critério '$($criterion.label)' precisa de peso maior que zero.")
        }
        if ($criterion.label -match '[\[\]]') {
            $problems.Add("O nome do critério '$($criterion.label)' não pode ter colchetes (usado nas fórmulas).")
        }
    }
    if ($fields -notcontains $Methodology.riskCriterionField) {
        $problems.Add("A coluna de risco ($($Methodology.riskCriterionField)) não corresponde a nenhum critério.")
    }
    return , $problems.ToArray()
}

function Get-ValueByPath($Source, [string] $Path) {
    $current = $Source
    foreach ($part in $Path.Split('.')) {
        if ($null -eq $current) { return $null }
        $current = $current[$part]
    }
    return $current
}

function Resolve-FieldChoices($Field, $Methodology, $Config) {
    <# Opções de uma coluna de escolha: "choices" fixas ou "choicesFrom" (metodologia ou ciclo de vida). #>
    if ($Field.Contains('choices')) {
        return , [string[]] @($Field.choices)
    }
    if (-not $Field.Contains('choicesFrom')) {
        return , [string[]] @()
    }
    $from = [string] $Field.choicesFrom
    if ($from -eq 'objectives') {
        return , [string[]] @($Methodology.objectives | ForEach-Object { $_.name })
    }
    if ($from.StartsWith('lifecycle.')) {
        return , [string[]] @(Get-ValueByPath $Config $from)
    }
    return , [string[]] @(Get-ValueByPath $Methodology $from)
}

function ConvertTo-XmlText([string] $Text) {
    return [System.Security.SecurityElement]::Escape($Text)
}

function Get-ScoreFieldSpecs($Methodology) {
    <# Uma coluna numérica (escala 1 a 5) por critério de valor e de custo/esforço/risco. #>
    $min = $Methodology.scale.min
    $max = $Methodology.scale.max
    $specs = @()
    foreach ($set in @(@{ key = 'valueCriteria'; kind = 'Valor' }, @{ key = 'costRiskCriteria'; kind = 'Custo/risco' })) {
        foreach ($criterion in $Methodology[$set.key]) {
            $specs += [ordered]@{
                internalName = $criterion.field
                displayName  = "Nota: $($criterion.label)"
                type         = 'Number'
                min          = $min
                max          = $max
                decimals     = 0
                description  = "$($set.kind), peso $($criterion.weight). $min = $($criterion.low); $max = $($criterion.high)."
            }
        }
    }
    return , $specs
}

function Get-WeightedExpression($Criteria, $Methodology, [hashtable] $DisplayNames) {
    $terms = @($Criteria | ForEach-Object { "[$($DisplayNames[$_.field])]*$($_.weight)" })
    $weights = 0
    foreach ($criterion in $Criteria) { $weights += $criterion.weight }
    return "($($terms -join '+'))/$($Methodology.scale.max * $weights)"
}

function Get-IndexFieldSpecs($Methodology, [hashtable] $DisplayNames) {
    <#
    Colunas calculadas VP, CR e IPP (seções 5.3 a 5.5), recalculadas pelo SharePoint a cada gravação.
    DisplayNames: nome interno da coluna de nota -> nome de exibição atual (as fórmulas usam o nome de exibição).
    Ficam vazias enquanto alguma nota estiver em branco.
    #>
    $value = @($Methodology.valueCriteria)
    $cost = @($Methodology.costRiskCriteria)
    $all = @($value + $cost)
    $refs = @($all | ForEach-Object { "[$($DisplayNames[$_.field])]" })
    $guard = "COUNT($($refs -join ','))<$($all.Count)"
    $vp = Get-WeightedExpression $value $Methodology $DisplayNames
    $cr = Get-WeightedExpression $cost $Methodology $DisplayNames
    $names = @($all | ForEach-Object { $_.field })

    return , @(
        [ordered]@{ internalName = 'ValorPonderado'; displayName = $script:IndexFields[0].displayName; type = 'Calculated'; decimals = 1; fieldRefs = $names
            formula = "=IF($guard,`"`",$vp*100)"; description = 'Valor Ponderado (0 a 100), calculado a partir das notas de valor.' }
        [ordered]@{ internalName = 'CustoRiscoPonderado'; displayName = $script:IndexFields[1].displayName; type = 'Calculated'; decimals = 1; fieldRefs = $names
            formula = "=IF($guard,`"`",$cr*100)"; description = 'Custo-Risco Ponderado (0 a 100): quanto a iniciativa consome e arrisca.' }
        [ordered]@{ internalName = 'IPP'; displayName = $script:IndexFields[2].displayName; type = 'Calculated'; decimals = 2; fieldRefs = $names
            formula = "=IF($guard,`"`",($vp)/($cr))"; description = 'Índice de Prioridade do Portfólio = VP ÷ CR.' }
    )
}

function New-FieldSchemaXml($Field, [string[]] $Choices, [string] $LookupListId) {
    <#
    XML da coluna. O nome de exibição é criado igual ao nome interno (garante o nome interno sem acentos)
    e trocado em seguida pelo script.
    #>
    $name = $Field.internalName
    $type = $Field.type
    $attributes = [ordered]@{
        Type        = $type
        Name        = $name
        StaticName  = $name
        DisplayName = $name
        ID          = "{$([guid]::NewGuid())}"
        Required    = if ($Field.Contains('required') -and $Field.required) { 'TRUE' } else { 'FALSE' }
        Group       = 'Gestão de Portfólio'
    }
    $inner = ''

    switch ($type) {
        'Text' { $attributes.MaxLength = '255' }
        'Note' { $attributes.NumLines = '6'; $attributes.RichText = 'FALSE'; $attributes.UnlimitedLengthInDocumentLibrary = 'FALSE' }
        { $_ -in 'Choice', 'MultiChoice' } {
            $attributes.Format = 'Dropdown'
            $attributes.FillInChoice = 'FALSE'
            $inner += '<CHOICES>' + (($Choices | ForEach-Object { "<CHOICE>$(ConvertTo-XmlText $_)</CHOICE>" }) -join '') + '</CHOICES>'
        }
        { $_ -in 'Number', 'Currency' } {
            if ($Field.Contains('min')) { $attributes.Min = [string] $Field.min }
            if ($Field.Contains('max')) { $attributes.Max = [string] $Field.max }
            $attributes.Decimals = if ($Field.Contains('decimals')) { [string] $Field.decimals } elseif ($type -eq 'Currency') { '2' } else { '0' }
            if ($type -eq 'Currency') { $attributes.LCID = '1046' }
        }
        'DateTime' { $attributes.Format = if ($Field.Contains('dateTime') -and $Field.dateTime) { 'DateTime' } else { 'DateOnly' } }
        'User' { $attributes.UserSelectionMode = 'PeopleOnly'; $attributes.UserSelectionScope = '0'; $attributes.List = 'UserInfo'; $attributes.ShowField = 'ImnName' }
        { $_ -in 'Lookup', 'LookupMulti' } {
            if (-not $LookupListId) { throw "Lista de pesquisa não informada para a coluna $name." }
            $attributes.List = "{$($LookupListId.Trim('{', '}'))}"
            $attributes.ShowField = if ($Field.Contains('showField')) { $Field.showField } else { 'Title' }
            if ($type -eq 'LookupMulti') { $attributes.Mult = 'TRUE' }
        }
        'Calculated' {
            $attributes.ResultType = 'Number'
            $attributes.Decimals = [string] $Field.decimals
            $attributes.ReadOnly = 'TRUE'
            $inner += "<Formula>$(ConvertTo-XmlText $Field.formula)</Formula>"
            $inner += '<FieldRefs>' + (($Field.fieldRefs | ForEach-Object { "<FieldRef Name=`"$_`" />" }) -join '') + '</FieldRefs>'
        }
        'Boolean' { }
        default { throw "Tipo de coluna não suportado: $type ($name)." }
    }

    if ($Field.Contains('indexed') -and $Field.indexed) { $attributes.Indexed = 'TRUE' }
    if ($Field.Contains('modelField') -and $Field.modelField) {
        $attributes.ShowInNewForm = 'FALSE'
        $attributes.ShowInEditForm = 'FALSE'
    }
    if ($Field.Contains('defaultToday') -and $Field.defaultToday) {
        $inner += '<Default>[today]</Default>'
    }
    elseif ($Field.Contains('default') -and $null -ne $Field.default) {
        $inner += "<Default>$(ConvertTo-XmlText ([string] $Field.default))</Default>"
    }

    $attributeText = ($attributes.Keys | ForEach-Object { "$_=`"$(ConvertTo-XmlText ([string] $attributes[$_]))`"" }) -join ' '
    return "<Field $attributeText>$inner</Field>"
}

function Merge-ChoicesIntoSchema([string] $SchemaXml, [string[]] $Choices) {
    <# Acrescenta ao XML de uma coluna de escolha existente as opções que faltam (as existentes são mantidas). Retorna $null se nada mudou. #>
    $xml = [xml] $SchemaXml
    $field = $xml.DocumentElement
    $node = $field.SelectSingleNode('CHOICES')
    if (-not $node) {
        $node = $xml.CreateElement('CHOICES')
        $null = $field.AppendChild($node)
    }
    $current = @($node.SelectNodes('CHOICE') | ForEach-Object { $_.InnerText })
    $missing = @($Choices | Where-Object { $current -notcontains $_ })
    if ($missing.Count -eq 0) {
        return $null
    }
    foreach ($choice in $missing) {
        $element = $xml.CreateElement('CHOICE')
        $element.InnerText = $choice
        $null = $node.AppendChild($element)
    }
    return $xml.OuterXml
}

function Set-FormulaInSchema([string] $SchemaXml, [string] $Formula) {
    <# Atualiza a fórmula de uma coluna calculada existente. Retorna $null se já estiver igual. #>
    $xml = [xml] $SchemaXml
    $node = $xml.DocumentElement.SelectSingleNode('Formula')
    if ($node -and $node.InnerText -eq $Formula) {
        return $null
    }
    if (-not $node) {
        $node = $xml.CreateElement('Formula')
        $null = $xml.DocumentElement.AppendChild($node)
    }
    $node.InnerText = $Formula
    return $xml.OuterXml
}

function Expand-FieldTokens([string[]] $Names, [string[]] $ScoreNames, [string[]] $IndexNames) {
    <# Substitui "$scores" e "$indexes" pelas colunas geradas a partir da metodologia. #>
    $result = @()
    foreach ($name in $Names) {
        switch ($name) {
            '$scores' { $result += $ScoreNames }
            '$indexes' { $result += $IndexNames }
            default { $result += $name }
        }
    }
    return , [string[]] $result
}

function New-ViewQuery([string[]] $Statuses, [string] $StatusField = 'Situacao', [string] $OrderBy, [bool] $Ascending = $true) {
    <# CAML da exibição: filtro por situações e ordenação. #>
    $where = ''
    if ($Statuses -and $Statuses.Count -gt 0) {
        $values = ($Statuses | ForEach-Object { "<Value Type='Choice'>$(ConvertTo-XmlText $_)</Value>" }) -join ''
        $where = "<Where><In><FieldRef Name='$StatusField' /><Values>$values</Values></In></Where>"
    }
    $order = ''
    if ($OrderBy) {
        $order = "<OrderBy><FieldRef Name='$OrderBy' Ascending='$(if ($Ascending) { 'TRUE' } else { 'FALSE' })' /></OrderBy>"
    }
    return "$where$order"
}

function New-FormFormatterJson($Sections, [hashtable] $DisplayNames, [string[]] $ScoreNames, [string[]] $IndexNames) {
    <# Formatação do formulário da lista em seções (Ficha Resumida da Iniciativa). Usa os nomes de exibição. #>
    $body = @{
        sections = @($Sections | ForEach-Object {
                $fields = Expand-FieldTokens ([string[]] $_.fields) $ScoreNames $IndexNames
                [ordered]@{
                    displayname = $_.title
                    fields      = @($fields | ForEach-Object { if ($DisplayNames.ContainsKey($_)) { $DisplayNames[$_] } else { $_ } })
                }
            })
    }
    $formatter = [ordered]@{
        headerJSONFormatter = ''
        bodyJSONFormatter   = ($body | ConvertTo-Json -Depth 10 -Compress)
        footerJSONFormatter = ''
    }
    return ($formatter | ConvertTo-Json -Depth 10 -Compress)
}

function Get-CycleName([datetime] $Date) {
    return '{0}-T{1}' -f $Date.Year, ([Math]::Floor(($Date.Month - 1) / 3) + 1)
}

function New-SampleData($Config, $Methodology, [datetime] $Today, [string] $Owner, [int] $Seed = 20261) {
    <#
    Dados de exemplo coerentes com a metodologia (somente demonstração): iniciativas em todas as situações,
    notas, estimativas, linhas de base, capacidade por equipe e decisões registradas. Determinístico (semente fixa).
    Retorna @{ initiatives; capacity; decisions; dependencies } — dependências e decisões referenciam o índice da iniciativa.
    #>
    $random = [System.Random]::new($Seed)
    $pick = { param($list) $list[$random.Next(0, @($list).Count)] }
    $between = { param([double] $min, [double] $max) $min + ($max - $min) * $random.NextDouble() }

    $names = @(
        'Implantação do Processo Eletrônico de Fiscalização', 'Painel de Transparência das Contas Municipais', 'Modernização da Central de Atendimento',
        'Adequação à Lei Geral de Proteção de Dados', 'Plataforma de Dados Abertos', 'Automação da Análise de Prestações de Contas',
        'Gestão de Riscos Institucionais', 'Revisão do Modelo de Planejamento Estratégico', 'Portal do Jurisdicionado – nova versão',
        'Assinatura Eletrônica de Documentos', 'Trilhas de Auditoria com Ciência de Dados', 'Programa de Capacitação em Gestão de Projetos',
        'Migração da Infraestrutura para Nuvem', 'Mapeamento de Processos Finalísticos', 'Sistema de Gestão de Contratos',
        'Escritório de Inovação', 'Atualização do Parque de Equipamentos', 'Gestão por Competências', 'Ouvidoria Digital',
        'Indicadores de Desempenho Institucional', 'Arquivo Digital e Gestão Documental', 'Aplicativo de Serviços ao Cidadão',
        'Segurança da Informação – SOC', 'Reestruturação do Fluxo de Denúncias', 'Monitoramento de Obras Públicas',
        'Catálogo de Serviços de TI', 'Programa de Qualidade de Vida no Trabalho', 'Inteligência Artificial na Triagem de Processos',
        'Revisão de Normativos Internos', 'Gestão do Conhecimento Institucional', 'Sustentabilidade e Eficiência Energética',
        'Integração com Sistemas Estaduais', 'Plano Diretor de Tecnologia da Informação', 'Automação de Relatórios Gerenciais',
        'Fiscalização de Políticas de Educação', 'Fiscalização de Políticas de Saúde', 'Gestão de Acordos de Cooperação',
        'Central de Atendimento ao Jurisdicionado', 'Biblioteca Digital', 'Painel de Gestão Orçamentária', 'Revisão da Carta de Serviços',
        'Programa de Integridade', 'Comunicação Institucional Digital', 'Sala de Situação de Fiscalização', 'Controle de Frota',
        'Gestão de Almoxarifado', 'Redesenho do Processo de Licitações', 'Malha Fina de Folha de Pagamento', 'Cadastro Único de Jurisdicionados',
        'Atendimento por Chatbot', 'Teletrabalho e Gestão de Desempenho', 'Ambiente de Análise de Dados', 'Padronização de Pareceres Técnicos',
        'Fiscalização de Parcerias com o Terceiro Setor', 'Gestão de Contratos de TI', 'Inventário de Sistemas Legados', 'Rede de Controle Externo',
        'Laboratório de Inovação em Auditoria', 'Avaliação de Políticas de Saneamento', 'Ciclo de Planejamento Anual de Fiscalização',
        'Gestão de Demandas do Ministério Público de Contas', 'Plano de Continuidade de Negócios', 'Acessibilidade Digital dos Portais',
        'Trilha de Formação de Lideranças', 'Gestão de Riscos de Fraude', 'Indicadores de Efetividade das Deliberações',
        'Revisão do Regimento Interno', 'Monitoramento de Deliberações', 'Calendário Unificado de Prestação de Contas',
        'Modernização do Plenário Virtual', 'Painel de Obras Paralisadas'
    )
    $units = @('Diretoria de Fiscalização', 'Diretoria de Tecnologia', 'Secretaria-Geral', 'Escola de Contas', 'Ouvidoria', 'Diretoria de Gestão de Pessoas', 'CIPP')
    $objectives = @($Methodology.objectives | Where-Object { $_.active } | ForEach-Object { $_.name })
    $teams = @($Methodology.teams)
    $categories = $Methodology.categories
    $criteria = @($Methodology.valueCriteria) + @($Methodology.costRiskCriteria)
    $valueFields = @($Methodology.valueCriteria | ForEach-Object { $_.field })

    $statuses = $Config.sampleData.statuses
    $intake = @('Registrada', 'Em análise', 'Em detalhamento')
    $active = @('Autorizada', 'Em andamento')
    $initiatives = [System.Collections.Generic.List[object]]::new()
    $decisions = [System.Collections.Generic.List[object]]::new()
    $index = 0

    foreach ($status in $statuses.Keys) {
        for ($n = 0; $n -lt $statuses[$status]; $n++) {
            $title = $names[$index % $names.Count]
            if ($index -ge $names.Count) { $title = "$title – fase $([Math]::Floor($index / $names.Count) + 1)" }
            $mandatory = ($index % 9 -eq 3)
            $effort = [Math]::Round((& $between 120 3200) / 10) * 10
            $duration = [Math]::Round((& $between 2 18), 0)
            $cost = [Math]::Round((& $between 5 900)) * 1000
            $item = [ordered]@{
                Title               = $title
                Situacao            = $status
                UnidadeDemandante   = & $pick $units
                Descricao           = "Necessidade identificada pela $((& $pick $units).ToLowerInvariant()): processos manuais, retrabalho e baixa visibilidade dos resultados."
                SolucaoProposta     = 'Redesenho do processo com apoio de solução tecnológica e indicadores de acompanhamento.'
                BeneficioEsperado   = 'Redução do tempo de ciclo e aumento da qualidade das entregas.'
                IndicadorBeneficio  = 'Tempo médio de tramitação (dias)'
                LinhaBase           = "$([Math]::Round((& $between 40 120))) dias"
                MetaBeneficio       = "$([Math]::Round((& $between 15 35))) dias"
                ObjetivoEstrategico = & $pick $objectives
                Natureza            = & $pick @($categories.nature)
                Motivacao           = if ($mandatory) { $categories.motivation[0] } else { & $pick @($categories.motivation | Select-Object -Skip 1) }
                Horizonte           = $categories.horizon[[Math]::Min(2, [Math]::Floor($duration / 7))]
                Porte               = if ($effort -lt 600) { 'Pequeno' } elseif ($effort -lt 1800) { 'Médio' } else { 'Grande' }
                Equipe              = & $pick $teams
                EsforcoEstimado     = $effort
                EsforcoCiclo        = [Math]::Round([Math]::Min($effort, (& $between 40 240)) / 10) * 10
                CustoEstimado       = $cost
                DuracaoMeses        = $duration
                Viabilidade         = 'Viável'
                ObrigacaoLegal      = $mandatory
                RespostaRiscoDefinida = ($random.NextDouble() -gt 0.1)
            }
            if ($mandatory) { $item.PrazoLegal = $Today.AddMonths($random.Next(3, 12)).Date }
            if ($Owner -and -not ($status -eq 'Registrada' -and $n -eq 0)) { $item.ResponsavelNegocio = $Owner }
            if ($status -eq 'Registrada') { $item.Viabilidade = 'Não avaliada' }
            if ($status -eq 'Em detalhamento') { $item.Remove('BeneficioEsperado') }

            if ($intake -notcontains $status) {
                foreach ($criterion in $criteria) {
                    $isValue = $valueFields -contains $criterion.field
                    # Valor tende a ser alto e custo/risco moderado nas que avançaram no fluxo.
                    $score = if ($isValue) { $random.Next(2, 6) } else { $random.Next(1, 5) }
                    $item[$criterion.field] = $score
                }
            }

            if ($active -contains $status -or @('Concluída', 'Suspensa') -contains $status) {
                $authorized = $Today.AddDays(-$random.Next(20, 240)).Date
                $start = $authorized.AddDays($random.Next(0, 30))
                $baselineEnd = $start.AddMonths([Math]::Max(1, $duration))
                # Maioria dentro das faixas; parte com desvio moderado ou alto.
                $roll = $random.NextDouble()
                $delay = if ($roll -lt 0.6) { & $between -0.05 0.08 } elseif ($roll -lt 0.85) { & $between 0.1 0.28 } else { & $between 0.31 0.5 }
                $item.GestorIniciativa = $Owner
                $item.CapacidadeAlocada = -not ($status -eq 'Autorizada' -and $n -lt 2)
                $item.DataAutorizacao = $authorized
                $item.InicioPrevisto = $start
                $item.TerminoPrevisto = $baselineEnd
                $item.TerminoProjetado = $baselineEnd.AddDays([Math]::Round(($baselineEnd - $start).TotalDays * $delay))
                $item.CustoAprovado = $cost
                $costDrift = if ($random.NextDouble() -lt 0.75) { & $between -0.05 0.08 } else { & $between 0.1 0.4 }
                $item.CustoProjetado = [Math]::Round($cost * (1 + $costDrift) / 1000) * 1000
                $item.PercentualConcluido = if ($status -eq 'Em andamento') { $random.Next(10, 91) } elseif ($status -eq 'Concluída') { 100 } else { 0 }
                $item.DataUltimaEntrega = $Today.AddDays(-$random.Next(3, $(if ($random.NextDouble() -lt 0.9) { 50 } else { 90 }))).Date
                $item.BeneficioComprometido = ($random.NextDouble() -lt 0.03)
                if ($status -eq 'Concluída') {
                    $item.BeneficioRealizado = $random.Next(40, 111)
                }
                $decisions.Add([ordered]@{ index = $index; point = '◆ 3 – Autorização'; decision = 'Aprovar integralmente'; date = $authorized; previous = 'Selecionada'; new = 'Autorizada'
                        body = 'Comitê de Portfólio'; justification = 'Selecionada na revisão trimestral; capacidade reservada e responsáveis designados.' })
                if ($status -eq 'Suspensa') {
                    $decisions.Add([ordered]@{ index = $index; point = '◆ 4 – Revisão do portfólio'; decision = 'Suspender'; date = $Today.AddDays(-$random.Next(5, 80)).Date; previous = 'Em andamento'; new = 'Suspensa'
                            body = 'Comitê de Portfólio'; justification = 'Falta de capacidade da equipe executora. Retomada condicionada à conclusão de iniciativa prioritária.' })
                }
                if ($status -eq 'Concluída') {
                    $decisions.Add([ordered]@{ index = $index; point = 'Encerramento ou retirada'; decision = 'Concluir'; date = $Today.AddDays(-$random.Next(10, 150)).Date; previous = 'Em andamento'; new = 'Concluída'
                            body = 'Comitê de Portfólio'; justification = 'Entregas aceitas; medição de benefícios iniciada.' })
                }
            }
            $initiatives.Add($item)
            $index++
        }
    }

    # Dependências entre candidatas e ativas (para demonstrar "priorizar em conjunto").
    $dependencies = @()
    $candidates = @(0..($initiatives.Count - 1) | Where-Object { @('Elegível', 'Priorizada', 'Selecionada', 'Em fila') -contains $initiatives[$_].Situacao })
    $activeIndexes = @(0..($initiatives.Count - 1) | Where-Object { $active -contains $initiatives[$_].Situacao })
    if ($candidates.Count -ge 2) { $dependencies += @{ index = $candidates[0]; dependsOn = @($candidates[$candidates.Count - 1]) } }
    if ($candidates.Count -ge 3 -and $activeIndexes.Count -ge 1) { $dependencies += @{ index = $candidates[1]; dependsOn = @($activeIndexes[0]) } }

    $capacity = @()
    foreach ($cycleDate in @($Today, $Today.AddMonths(3))) {
        foreach ($team in $teams) {
            $capacity += [ordered]@{
                Title           = Get-CycleName $cycleDate
                Equipe          = $team
                CapacidadeTotal = $Config.sampleData.capacityPerTeam.total
                Sustentacao     = $Config.sampleData.capacityPerTeam.sustainment
                LimiteWIP       = $Config.sampleData.capacityPerTeam.wipLimit
            }
        }
    }

    return @{ initiatives = $initiatives.ToArray(); capacity = $capacity; decisions = $decisions.ToArray(); dependencies = $dependencies }
}

Export-ModuleMember -Function Remove-JsonComments, Test-MethodologyParameters, Resolve-FieldChoices, Get-ScoreFieldSpecs, Get-IndexFieldSpecs,
New-FieldSchemaXml, Merge-ChoicesIntoSchema, Set-FormulaInSchema, Expand-FieldTokens, New-ViewQuery, New-FormFormatterJson, Get-CycleName, New-SampleData
