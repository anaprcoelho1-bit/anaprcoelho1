import * as React from 'react';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField
} from '@microsoft/sp-property-pane';
import { BaseSectionWebPart } from '../../common/BaseSectionWebPart';
import { itemsField } from '../../common/propertyPane';
import SupportTools, { type ISupportToolsProps } from './components/SupportTools';

export default class SupportToolsWebPart extends BaseSectionWebPart<ISupportToolsProps> {
  protected get defaultProperties(): ISupportToolsProps {
    return {
      title: 'Ferramentas e materiais de apoio',
      subtitle: 'Documentos, orientações e instrumentos para o dia a dia.',
      items: [
        { title: 'Metodologia de Gestão de Portfólio', icon: 'ReadingMode', url: '' },
        { title: 'Critérios de Priorização', icon: 'BulletedList', url: '' },
        { title: 'Fluxo da Gestão de Portfólio', icon: 'Flow', url: '' },
        { title: 'Papéis e Responsabilidades', icon: 'People', url: '' },
        { title: 'Modelos e Documentos', icon: 'FabricFolder', url: '' },
        { title: 'Perguntas Frequentes', icon: 'Unknown', url: '' }
      ],
      helpTitle: 'Precisa de ajuda?',
      helpText: 'Entre em contato com a Coordenadoria Integrada de Projetos e Processos – CIPP.',
      helpIcon: 'Message',
      helpButtonText: 'Fale com a CIPP',
      helpButtonUrl: ''
    };
  }

  protected renderSection(properties: ISupportToolsProps): React.ReactElement {
    return React.createElement(SupportTools, properties);
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: 'Ferramentas, materiais de apoio e contato.' },
          groups: [
            {
              groupName: 'Ferramentas',
              groupFields: [
                PropertyPaneTextField('title', { label: 'Título da seção' }),
                PropertyPaneTextField('subtitle', { label: 'Descrição da seção', multiline: true }),
                itemsField('items', 'Ferramentas', this.properties.items, { icon: true, url: true })
              ]
            },
            {
              groupName: 'Quadro "Precisa de ajuda?"',
              groupFields: [
                PropertyPaneTextField('helpTitle', { label: 'Título', description: 'Deixe em branco para ocultar o quadro.' }),
                PropertyPaneTextField('helpText', { label: 'Texto', multiline: true }),
                PropertyPaneTextField('helpIcon', { label: 'Ícone (nome Fluent UI)' }),
                PropertyPaneTextField('helpButtonText', { label: 'Texto do botão' }),
                PropertyPaneTextField('helpButtonUrl', { label: 'Link do botão', description: 'Ex.: mailto:cipp@tce.mg.gov.br ou link de formulário.' })
              ]
            }
          ]
        }
      ]
    };
  }
}
