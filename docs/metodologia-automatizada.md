# Metodologia de Gestão de Portfólio – implementação e automação

Este documento mostra como cada parte da **Metodologia de Gestão de Portfólio** foi implementada no
site da CIPP e o que passou a ser automático. A metodologia em si está em
[`provisioning/assets/Metodologia-Gestao-de-Portfolio.docx`](../provisioning/assets/Metodologia-Gestao-de-Portfolio.docx),
publicada no site e linkada no card "Metodologia de Gestão de Portfólio".

## Visão geral

```
metodologia.json ──► colunas de notas + fórmulas VP/CR/IPP (lista Iniciativas)
      │
      └──────────► motor de regras (spfx/src/methodology) ──► web parts operacionais
                                                              ├─ Priorização (etapas 1 a 4, ◆1)
Listas do site:                                               ├─ Seleção e balanceamento (etapa 5, ◆2, ◆3)
  Iniciativas (inventário + ficha)  ─────────────────────────►├─ Monitoramento e indicadores (etapas 7 e 8, ◆4, etapa 9)
  Mapa de Capacidade                                          └─ Relatório executivo (artefatos 4 e 8)
  Registro de Decisões   ◄──── painel "Registrar decisão" (todas as decisões)
  Pontuações do Comitê (opcional)
```

- **Fonte única de parâmetros:** `provisioning/metodologia.json` define critérios, pesos, faixas de IPP,
  limites (reserva de capacidade, WIP, semáforo, permanência), metas dos indicadores, objetivos
  estratégicos, equipes, categorias e faixas de balanceamento. O script publica o arquivo no site e as
  web parts o leem; o mesmo arquivo gera as colunas de notas e as fórmulas de VP, CR e IPP.
- **Motor de regras:** funções puras em TypeScript (`spfx/src/methodology`), cobertas por testes
  automatizados, que aplicam todas as regras do documento aos dados das listas.
- **Decisão continua sendo humana.** O modelo calcula, ordena, verifica e **sugere**; quem decide é o
  Gestor do Portfólio, o Comitê ou a alta gestão (conforme a alçada). Toda decisão é registrada.

## Rastreabilidade: metodologia → implementação

| Seção da metodologia | Onde está | O que é automático |
| --- | --- | --- |
| 3.1/3.2 Componentes do portfólio | Lista **Iniciativas**, coluna *Natureza* | – |
| 3.3 Critérios de entrada | Motor (`entryCriteria`) – aba *Fila de entrada* | Verificação dos 6 critérios cumulativos, com as pendências de cada iniciativa |
| 3.3 Critérios de permanência | Motor (`permanenceTriggers`) – Monitoramento | Gatilhos: objetivo extinto, benefício comprometido, custo > +30%, aprovada sem equipe há mais de um ciclo, sem entregas por 2 ciclos, risco crítico sem resposta |
| Etapa 1 – Identificação e registro | Formulário da lista (Ficha Resumida em seções), card "Solicitar nova iniciativa", exibição *Fila de entrada* | Situação inicial "Registrada"; código INI-AAAA-NNN gerado |
| Etapa 2 – Análise e ◆1 Elegibilidade | Web part **Priorização** → *Fila de entrada* | Critérios de entrada, pontos de controle, verificação de duplicidade por semelhança de nome, sugestão (Iniciar análise / Elegível / Devolver / Recusar) |
| Etapa 3 – Categorização | Colunas Natureza, Motivação, Objetivo, Horizonte, Porte, Equipe, Unidade | Opções vindas de `metodologia.json` |
| Etapa 4 – Priorização (5.1 a 5.5) | Colunas de notas + calculadas **VP**, **CR**, **IPP**; web part **Priorização** → *Matriz de priorização* | VP = Σ nota×peso ÷ 120 × 100; CR = Σ nota×peso ÷ 60 × 100; IPP = VP ÷ CR; leitura da faixa; ranking; quartil superior; "Elegível" com notas completas passa a "Priorizada" |
| Etapa 4 – Pontuação colegiada | Lista **Pontuações do Comitê** (opcional) | Divergências > 2 pontos apontadas; botão "Aplicar mediana" quando não há divergência |
| 5.2 Pontos de controle | Motor (`evaluateGates`) | Inviável não entra; obrigatória entra com capacidade reservada; sem objetivo e não obrigatória não entra |
| 5.6 Adaptações permitidas | `metodologia.json` + script | Validação: até 8 critérios de valor, pesos > 0, colunas únicas; fórmulas atualizadas ao reexecutar o script |
| Etapa 5 – Seleção e ◆2 Composição | Web part **Seleção e balanceamento**; lista **Mapa de Capacidade** | Capacidade alocável = total − sustentação − reserva; percorre a lista priorizada até o limite; obrigatórias primeiro; dependências selecionadas em conjunto ou bloqueadas; WIP e capacidade por equipe; IPP < 0,70 sugerido para descarte; IPP 0,70–0,99 com alerta de fasear; sugestão de fatiamento |
| 6.1 Balanceamento | Mesma web part | Participação por horizonte, inovação × sustentação, obrigatório × estratégico e risco contra as faixas; objetivos prioritários sem investimento; distribuição por área |
| 6.2 Visualizações | Mesma web part | Matriz Valor × Custo-Risco (bolhas = custo), barras 100% por dimensão, mapa de calor por objetivo estratégico |
| 6.3 Regras práticas | Motor (`selectPortfolio`, `rankByIpp`) | Limite de WIP, reserva de capacidade, preferência pelo fluxo (IPP semelhante → menor duração), verificação de dependências |
| Etapa 6 – ◆3 Autorização | Painel **Registrar decisão** | Data de autorização gravada; custo aprovado (linha de base) fixado; alçada sugerida |
| 7/8 Papéis, RACI, alçadas | Alçada calculada (`authorityLevel`) e campo *Instância* no Registro de Decisões | Pequeno / médio / grande porte por esforço, custo, impacto transversal e necessidade de novo orçamento |
| 8.4 Princípios de governança | Lista **Registro de Decisões** | Toda decisão registrada com data, ponto de decisão, decisão, justificativa, instância e situação anterior/nova; justificativa obrigatória para recusas, descartes, suspensões e encerramentos |
| Etapa 7 / 9 – Monitoramento | Web part **Monitoramento e indicadores** | Desvio de prazo e de custo, semáforo (9.1), alertas, "Autorizada" com progresso passa a "Em andamento" |
| 9.1 Semáforo | Motor (`trafficLight`) + coluna *Semáforo* formatada | Verde/Amarelo/Vermelho pelos critérios objetivos do documento |
| Etapa 8 – ◆4 Revisão (10.2) | Monitoramento → *Decisão sugerida* | Manter, repriorizar, acelerar, suspender, replanejar, encerrar conforme gatilhos, IPP e prazo legal; "Replanejar" aprova nova linha de base |
| Etapa 9 – Encerramento | Painel **Registrar decisão** | Concluir (progresso 100%), cancelar, absorver; benefício continua sendo medido (*Benefício realizado (%)*) |
| 11 Indicadores (8) | Monitoramento e Relatório | Os 8 indicadores com fórmula, meta e situação |
| 11.1 Leitura combinada | Monitoramento e Relatório | As 5 combinações do documento geram alertas de interpretação |
| 12 Artefatos | Ver tabela abaixo | – |
| 14.1 Calendário | Rotina abaixo | – |

### Artefatos (seção 12)

| # | Artefato | Implementação |
| --- | --- | --- |
| 1 | Inventário / Mapa do Portfólio | Lista **Iniciativas** (exibições *Fila de entrada*, *Matriz de priorização*, *Portfólio ativo*, *Encerradas e retiradas*) |
| 2 | Ficha Resumida da Iniciativa | Formulário da lista organizado nas seções da ficha (12.1) |
| 3 | Matriz de Avaliação e Priorização | Colunas de notas, VP, CR, IPP + web part **Priorização** |
| 4 | Roadmap do Portfólio | Web part **Relatório executivo** (linha do tempo por trimestre) |
| 5 | Painel de Indicadores | Web part **Monitoramento e indicadores** (1 tela) |
| 6 | Mapa de Capacidade e Recursos | Lista **Mapa de Capacidade** + quadro por equipe na **Seleção e balanceamento** |
| 7 | Registro de Decisões | Lista **Registro de Decisões**, alimentada pelo painel de decisão |
| 8 | Relatório Executivo | Web part **Relatório executivo** (imprimir/PDF) |

## Ciclo de vida da iniciativa

```
Registrada → Em análise ─◆1─┬─ Elegível → Priorizada ─◆2─┬─ Selecionada ─◆3─┬─ Autorizada → Em andamento ─◆4/Etapa 9─┬─ Concluída
           ↑                ├─ Em detalhamento ─┘        ├─ Em fila          └─ Pendente de aprovação             ├─ Suspensa (→ Retomar)
           └────────────────┘                            └─ Descartada                                            ├─ Cancelada
                            └─ Não elegível                                                                       └─ Absorvida
```

Transições automáticas (botão **Atualizar lista**): *Elegível* com todas as notas → *Priorizada*;
*Autorizada* com progresso > 0 → *Em andamento*. As demais mudanças de situação acontecem pelo painel
**Registrar decisão**, que grava o Registro de Decisões.

## Rotina de operação (calendário 14.1)

| Quando | Quem | Onde | O que fazer |
| --- | --- | --- | --- |
| Contínuo | Proponente / responsável de negócio | Lista Iniciativas → *Novo* | Preencher a ficha (máx. 1 página) |
| Mensal – triagem | Gestor do Portfólio | **Priorização** → *Fila de entrada* | Completar pendências, avaliar viabilidade, registrar ◆1 |
| Mensal – acompanhamento | Gestores de iniciativa | Lista Iniciativas | Atualizar progresso, término e custo projetados, data da última entrega, riscos, benefício |
| Mensal – acompanhamento | Gestor do Portfólio | **Monitoramento** → *Atualizar lista* | Gravar semáforo, alertas e sugestões; levar vermelhos ao Comitê |
| Trimestral – início do ciclo | Gestor do Portfólio | Lista **Mapa de Capacidade** | Cadastrar capacidade total, sustentação, reserva e WIP por equipe para o novo ciclo (AAAA-Tn) |
| Trimestral – revisão (3 a 4 h) | Comitê | **Priorização** → **Seleção** → **Monitoramento** | Pontuar (◆ divergências), compor o portfólio (◆2), autorizar (◆3), revisar ativas (◆4), encerrar |
| Trimestral | Gestor do Portfólio | **Relatório executivo** → *Imprimir / PDF* | Enviar à alta gestão |
| Semestral | Responsáveis de negócio | Lista Iniciativas | Registrar *Benefício realizado (%)* das concluídas |
| Anual | Alta gestão | `metodologia.json` | Revisar pesos, faixas, objetivos e metas; reexecutar o script (ver abaixo) |

## Ajustar a metodologia (revisão anual)

1. Edite `provisioning/metodologia.json` (pesos, critérios, faixas de IPP, limites, objetivos, equipes).
   Regras validadas pelo script: até 8 critérios de valor, pesos maiores que zero, nomes de coluna
   únicos (letras e números).
2. Publique sem mexer nas páginas:

   ```powershell
   ./Deploy-GestaoPortfolio.ps1 -SiteUrl <site> -ClientId <id> -SkipApp -SkipTheme -SkipNavigation -SkipPage
   ```

   O script publica o novo `metodologia.json`, cria colunas para critérios novos, acrescenta opções
   novas (objetivos, equipes, categorias) e atualiza as fórmulas de VP, CR e IPP.
3. Nas web parts, os novos valores valem imediatamente.

Para manter os padrões embutidos nas web parts iguais ao arquivo, atualize também
`spfx/src/methodology/parameters.ts` — o teste `parameters.test.ts` falha se os dois divergirem.

> Não altere os pesos no meio de uma priorização (seção 5.6). Um objetivo estratégico extinto deve ser
> marcado com `"active": false` (não removido): as iniciativas vinculadas a ele recebem o gatilho de
> permanência "Objetivo estratégico alterado ou extinto".

## Limitações conhecidas

- O botão **Atualizar lista** grava os campos do modelo (código, ranking, semáforo, alertas, sugestão,
  alçada) com as permissões de quem clica. Não há gravação agendada sem intervenção; as telas não
  dependem dela, pois calculam tudo a cada abertura, e VP, CR e IPP são colunas calculadas pelo próprio
  SharePoint.
- Notificações por e-mail (ex.: avisar o proponente sobre a decisão) não fazem parte desta entrega;
  podem ser criadas com Power Automate a partir da lista **Registro de Decisões**.
- O ciclo de capacidade é trimestral (AAAA-Tn); pode ser fixado no painel de propriedades das web parts.
