# Gestão de Portfólio – layout no SharePoint (CIPP / TCEMG)

Implementação no SharePoint Online do layout da página **Gestão de Portfólio** da Coordenadoria
Integrada de Projetos e Processos (CIPP).

O layout tem elementos que as web parts nativas não reproduzem (cards coloridos, fluxo numerado,
indicadores e gráficos). Por isso a página é montada com **web parts SPFx próprias**, uma por faixa do
layout, e um **script PnP.PowerShell** que configura o site e monta a página.

![Prévia das web parts com dados de exemplo](docs/preview-desktop.png)

> A prévia acima foi gerada localmente com dados de exemplo e sem as fotos (o banner e a faixa
> "O que é" usam a imagem configurada; sem imagem, aparece um degradê).

## Estrutura

```
spfx/                              Solução SharePoint Framework 1.23 (React + TypeScript)
  src/webparts/                    Uma web part por faixa do layout
  src/common/                      Estilos, componentes e base compartilhados
provisioning/
  Deploy-GestaoPortfolio.ps1       Publica o pacote, aplica tema, navegação, lista e monta a página
  gestao-portfolio.config.json     Conteúdo da implantação (navegação, lista, seções, links)
  theme/cipp-theme.json            Paleta de cores do site (azul-marinho do layout)
  assets/                          Imagens opcionais (banner, foto da sede, logotipos)
docs/preview-desktop.png           Prévia do resultado
```

## Faixas do layout → web parts

Todas aparecem na caixa de ferramentas do editor de páginas no grupo **CIPP – Gestão de Portfólio**
e ficam em seções de **largura total**.

| Faixa do layout                         | Web part                              | Conteúdo editável no painel de propriedades |
| --------------------------------------- | ------------------------------------- | ------------------------------------------- |
| Banner "Gestão de Portfólio"            | Portfólio: Banner principal           | Título, subtítulo, texto, botão, imagem, palavras do painel lateral |
| Acessos principais                      | Portfólio: Acessos principais         | Cards (título, descrição, ícone, link, cor) |
| O que é a Gestão de Portfólio?          | Portfólio: O que é                    | Texto, botão, destaques, ícone, imagem |
| Como funciona?                          | Portfólio: Como funciona              | Etapas (título, descrição, ícone); numeração automática |
| Critérios para análise e priorização    | Portfólio: Critérios de priorização   | Critérios (título, descrição, ícone) |
| Acompanhe nosso Portfólio + Principais indicadores | Portfólio: Painel de indicadores | Textos, links, lista de origem, situações e cores |
| Ferramentas e materiais de apoio + Precisa de ajuda? | Portfólio: Ferramentas e ajuda | Atalhos (título, ícone, link) e quadro de contato |
| Rodapé TCEMG / CIPP                     | Portfólio: Rodapé institucional       | Logotipo, nomes e lema |

A barra superior (busca, notificações, avatar) e o menu (Início, Sobre a CIPP, Projetos, Processos,
Gestão de Portfólio, Conhecimento) são os elementos **nativos** do SharePoint, configurados pelo script:
tema com o azul do layout, cabeçalho padrão, megamenu e itens de navegação.

### Painel de indicadores

Os números e gráficos são calculados em tempo real a partir da lista **Iniciativas** do próprio site,
criada pelo script com as colunas:

| Coluna (nome interno)                   | Tipo    | Uso |
| --------------------------------------- | ------- | --- |
| Iniciativa (`Title`)                    | Texto   | Nome da iniciativa |
| Situação (`Situacao`)                   | Escolha | Em análise, Priorizada, Planejada, Em andamento, Concluída, Suspensa |
| Objetivo estratégico (`ObjetivoEstrategico`) | Escolha | Gráfico de barras por objetivo |
| Unidade demandante (`UnidadeDemandante`) | Texto  | Informativo |
| Descrição da necessidade (`Descricao`)  | Texto multilinha | Informativo |

Os cards "Solicitar nova iniciativa" e "Consultar o Portfólio" apontam para o formulário e a
exibição dessa lista. Nome da lista, colunas, situações exibidas e cores podem ser trocados no painel
de propriedades da web part (por exemplo, para usar uma lista já existente).

## Implantação

### Pré-requisitos

- **Node.js 22** (22.14 ou superior) para gerar o pacote.
- **PowerShell 7.4+** e **PnP.PowerShell 3.x**: `Install-Module PnP.PowerShell -Scope CurrentUser`.
- Um aplicativo Entra ID para o PnP.PowerShell (uma vez por tenant):
  `Register-PnPEntraIDAppForInteractiveLogin -ApplicationName "PnP PowerShell" -Tenant contoso.onmicrosoft.com`.
- Um **site de comunicação** (seções de largura total só existem nesse tipo de site).
- Permissões: administrador do catálogo de aplicativos (publicar o pacote), administrador do
  SharePoint (registrar o tema no tenant) e proprietário do site. Sem essas permissões, veja
  `-SkipApp` e `-SkipTheme` abaixo.

### 1. Gerar o pacote SPFx

```bash
cd spfx
npm ci
npm run build        # gera spfx/sharepoint/solution/cipp-portfolio.sppkg
```

### 2. Imagens (opcional)

Coloque em `provisioning/assets/` as imagens descritas em
[`provisioning/assets/LEIA-ME.md`](provisioning/assets/LEIA-ME.md) (banner, foto da sede, logotipos).

### 3. Revisar a configuração

Em `provisioning/gestao-portfolio.config.json`, ajuste principalmente:

- `navigation.nodes`: os links de "Sobre a CIPP", "Projetos", "Processos" e "Conhecimento" apontam para
  a página inicial do site até que as páginas de destino existam;
- `page.sections[].properties`: links dos cards e botões (os itens sem `url` aparecem sem seta);
- `page.setAsHomePage`: `true` para tornar a página a inicial do site.

### 4. Executar o script

```powershell
cd provisioning
./Deploy-GestaoPortfolio.ps1 -SiteUrl https://contoso.sharepoint.com/sites/cipp -ClientId <id-do-aplicativo>
```

Opções úteis:

| Parâmetro              | Efeito |
| ---------------------- | ------ |
| `-SeedSampleData`      | Insere 71 iniciativas de exemplo (as quantidades do layout) para demonstrar o painel |
| `-AppCatalogScope Site`| Usa o catálogo de aplicativos do próprio site em vez do catálogo do tenant |
| `-SkipApp`             | Não publica o pacote (já publicado pelo administrador) |
| `-SkipTheme`           | Não registra/aplica o tema (exige administrador do SharePoint) |
| `-SkipNavigation`, `-SkipList`, `-SkipPage` | Pulam as respectivas etapas |

O script pode ser executado novamente: a página é limpa e remontada a partir da configuração, e a
lista e as colunas existentes são preservadas. **Edições feitas na página pelo navegador são
substituídas** a cada execução sem `-SkipPage`.

### 5. Editar o conteúdo

Depois de implantada, a página é editada normalmente no SharePoint: **Editar** → selecionar a web
part → ícone de lápis. Textos, cards, etapas, critérios, ferramentas, links e imagens ficam no painel
de propriedades; listas de itens abrem um editor com adicionar, remover e reordenar. Os ícones usam os
nomes do Fluent UI (seletor disponível no editor de itens).

Também é possível montar a página manualmente: crie uma página, adicione oito seções de largura total
e insira as web parts do grupo **CIPP – Gestão de Portfólio** na ordem da tabela acima.

## Desenvolvimento

```bash
cd spfx
npm start            # servidor local; abra https://<tenant>.sharepoint.com/_layouts/workbench.aspx
npm run build        # build de produção + lint + pacote
```

As web parts compartilham `src/common/BaseSectionWebPart.ts`, que preenche as propriedades ausentes
com o conteúdo padrão do layout (definido no getter `defaultProperties` de cada web part). Assim cada
web part já aparece completa ao ser adicionada e o script só precisa informar o que muda (links e
imagens).
