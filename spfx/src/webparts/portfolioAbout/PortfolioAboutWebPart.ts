import * as React from 'react';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField
} from '@microsoft/sp-property-pane';
import { BaseSectionWebPart } from '../../common/BaseSectionWebPart';
import PortfolioAbout, { type IPortfolioAboutProps } from './components/PortfolioAbout';

export default class PortfolioAboutWebPart extends BaseSectionWebPart<IPortfolioAboutProps> {
  protected get defaultProperties(): IPortfolioAboutProps {
    return {
      title: 'O que é a Gestão de Portfólio?',
      text:
        'É o processo contínuo de identificar, analisar, priorizar, acompanhar e revisar iniciativas, garantindo o alinhamento com os objetivos institucionais e a melhor utilização dos recursos disponíveis.',
      buttonText: 'Conheça mais',
      buttonUrl: '',
      icon: 'BullseyeTarget',
      highlights: 'Mais foco.\nMais resultados.\nMais valor para a sociedade.',
      imageUrl: '',
      imageAlt: 'Fachada do Tribunal de Contas do Estado de Minas Gerais'
    };
  }

  protected renderSection(properties: IPortfolioAboutProps): React.ReactElement {
    return React.createElement(PortfolioAbout, properties);
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: 'Faixa "O que é a Gestão de Portfólio?".' },
          groups: [
            {
              groupName: 'Texto',
              groupFields: [
                PropertyPaneTextField('title', { label: 'Título' }),
                PropertyPaneTextField('text', { label: 'Texto', multiline: true, rows: 5 }),
                PropertyPaneTextField('buttonText', { label: 'Texto do botão', description: 'Deixe em branco para ocultar o botão.' }),
                PropertyPaneTextField('buttonUrl', { label: 'Link do botão' })
              ]
            },
            {
              groupName: 'Destaques e imagem',
              groupFields: [
                PropertyPaneTextField('icon', { label: 'Ícone (nome Fluent UI)', description: 'Ex.: BullseyeTarget' }),
                PropertyPaneTextField('highlights', { label: 'Destaques (um por linha)', multiline: true, rows: 4 }),
                PropertyPaneTextField('imageUrl', { label: 'URL da imagem', description: 'Sem imagem, o painel da direita é ocultado.' }),
                PropertyPaneTextField('imageAlt', { label: 'Texto alternativo da imagem' })
              ]
            }
          ]
        }
      ]
    };
  }
}
