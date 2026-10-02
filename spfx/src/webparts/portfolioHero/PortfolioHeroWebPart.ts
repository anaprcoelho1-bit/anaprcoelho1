import * as React from 'react';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField
} from '@microsoft/sp-property-pane';
import { BaseSectionWebPart } from '../../common/BaseSectionWebPart';
import PortfolioHero, { type IPortfolioHeroProps } from './components/PortfolioHero';

export default class PortfolioHeroWebPart extends BaseSectionWebPart<IPortfolioHeroProps> {
  protected get defaultProperties(): IPortfolioHeroProps {
    return {
      title: 'Gestão de Portfólio',
      subtitle: 'Conectando estratégia, prioridades e resultados.',
      description:
        'A Gestão de Portfólio apoia a seleção, priorização e acompanhamento das iniciativas, promovendo uma visão integrada para direcionar esforços e recursos às necessidades que geram maior valor para a organização.',
      buttonText: 'Saiba mais',
      buttonUrl: '',
      imageUrl: '',
      asideWords: 'Planejar\nPriorizar\nExecutar\nEntregar\nTransformar',
      asideTagline: 'Valor para uma administração pública melhor'
    };
  }

  protected renderSection(properties: IPortfolioHeroProps): React.ReactElement {
    return React.createElement(PortfolioHero, properties);
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: 'Banner principal da página Gestão de Portfólio.' },
          groups: [
            {
              groupName: 'Conteúdo',
              groupFields: [
                PropertyPaneTextField('title', { label: 'Título' }),
                PropertyPaneTextField('subtitle', { label: 'Subtítulo' }),
                PropertyPaneTextField('description', { label: 'Texto', multiline: true, rows: 5 }),
                PropertyPaneTextField('buttonText', { label: 'Texto do botão', description: 'Deixe em branco para ocultar o botão.' }),
                PropertyPaneTextField('buttonUrl', { label: 'Link do botão' })
              ]
            },
            {
              groupName: 'Imagem e lema',
              groupFields: [
                PropertyPaneTextField('imageUrl', {
                  label: 'URL da imagem de fundo',
                  description: 'Ex.: /sites/cipp/SiteAssets/gestao-portfolio/hero.jpg. Sem imagem, é usado um degradê.'
                }),
                PropertyPaneTextField('asideWords', { label: 'Palavras do painel lateral (uma por linha)', multiline: true, rows: 5 }),
                PropertyPaneTextField('asideTagline', { label: 'Lema do painel lateral' })
              ]
            }
          ]
        }
      ]
    };
  }
}
