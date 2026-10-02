import * as React from 'react';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField
} from '@microsoft/sp-property-pane';
import { BaseSectionWebPart } from '../../common/BaseSectionWebPart';
import { itemsField } from '../../common/propertyPane';
import QuickAccess, { type IQuickAccessProps } from './components/QuickAccess';

export default class QuickAccessWebPart extends BaseSectionWebPart<IQuickAccessProps> {
  protected get defaultProperties(): IQuickAccessProps {
    return {
      title: 'Acessos principais',
      subtitle: 'Encontre rapidamente os principais recursos para solicitar, consultar e acompanhar as iniciativas do portfólio.',
      items: [
        {
          title: 'Solicitar nova iniciativa',
          description: 'Registre uma nova necessidade, problema ou oportunidade para análise.',
          icon: 'PageAdd',
          url: '',
          accent: 'blue'
        },
        {
          title: 'Consultar o Portfólio',
          description: 'Acompanhe as iniciativas, prioridades, situação e andamento.',
          icon: 'BarChartVertical',
          url: '',
          accent: 'green'
        },
        {
          title: 'Metodologia de Gestão de Portfólio',
          description: 'Conheça o processo, critérios, papéis e responsabilidades.',
          icon: 'ReadingMode',
          url: '',
          accent: 'orange'
        },
        {
          title: 'Indicadores do Portfólio',
          description: 'Consulte os principais indicadores e a visão consolidada das iniciativas.',
          icon: 'PieSingle',
          url: '',
          accent: 'purple'
        }
      ]
    };
  }

  protected renderSection(properties: IQuickAccessProps): React.ReactElement {
    return React.createElement(QuickAccess, properties);
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: 'Cards de acesso rápido.' },
          groups: [
            {
              groupName: 'Conteúdo',
              groupFields: [
                PropertyPaneTextField('title', { label: 'Título da seção' }),
                PropertyPaneTextField('subtitle', { label: 'Descrição da seção', multiline: true }),
                itemsField('items', 'Cards', this.properties.items, { description: true, icon: true, url: true, accent: true })
              ]
            }
          ]
        }
      ]
    };
  }
}
