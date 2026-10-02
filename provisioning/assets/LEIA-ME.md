# Imagens e documentos do layout

Coloque aqui as imagens usadas pela página. O script `Deploy-GestaoPortfolio.ps1` envia cada arquivo
encontrado para `SiteAssets/gestao-portfolio` e configura a web part correspondente. Arquivos ausentes
são ignorados e a web part usa o visual padrão (degradê ou sigla em texto).

| Arquivo             | Onde aparece                                  | Tamanho sugerido      |
| ------------------- | --------------------------------------------- | --------------------- |
| `hero.jpg`          | Fundo do banner principal (lado direito)      | 1920 × 600 px         |
| `sede-tcemg.jpg`    | Imagem da faixa "O que é a Gestão de Portfólio?" | 800 × 400 px       |
| `logo-tcemg.png`    | Logotipo no rodapé institucional              | até 440 × 112 px, fundo transparente |
| `logo-cipp.png`     | Logotipo do site no cabeçalho do SharePoint   | 64 × 64 px (ou maior, quadrado) |
| `Metodologia-Gestao-de-Portfolio.docx` | Documento da metodologia (card, botão "Conheça mais" e Ferramentas) | – |

Os nomes podem ser alterados em `gestao-portfolio.config.json` (tokens `{asset:arquivo}`).
