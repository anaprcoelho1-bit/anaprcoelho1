import * as React from 'react';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField
} from '@microsoft/sp-property-pane';
import { BaseSectionWebPart } from '../../common/BaseSectionWebPart';
import { itemsField } from '../../common/propertyPane';
import AnalysisCriteria, { type IAnalysisCriteriaProps } from './components/AnalysisCriteria';

export default class AnalysisCriteriaWebPart extends BaseSectionWebPart<IAnalysisCriteriaProps> {
  protected get defaultProperties(): IAnalysisCriteriaProps {
    return {
      title: 'Critérios para análise e priorização',
      subtitle: 'As iniciativas são avaliadas considerando diferentes dimensões.',
      items: [
        { title: 'Alinhamento Estratégico', description: 'Contribuição para os objetivos institucionais.', icon: 'BullseyeTarget' },
        { title: 'Valor e Impacto', description: 'Benefícios e resultados esperados.', icon: 'BarChartVertical' },
        { title: 'Urgência', description: 'Necessidade e criticidade da iniciativa.', icon: 'Clock' },
        { title: 'Evidências', description: 'Dados que sustentam a necessidade.', icon: 'TextDocument' },
        { title: 'Esforço e Complexidade', description: 'Recursos e capacidade necessários.', icon: 'Settings' },
        { title: 'Riscos e Dependências', description: 'Incertezas e relação com outras iniciativas.', icon: 'Warning' }
      ]
    };
  }

  protected renderSection(properties: IAnalysisCriteriaProps): React.ReactElement {
    return React.createElement(AnalysisCriteria, properties);
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: 'Critérios para análise e priorização.' },
          groups: [
            {
              groupName: 'Conteúdo',
              groupFields: [
                PropertyPaneTextField('title', { label: 'Título da seção' }),
                PropertyPaneTextField('subtitle', { label: 'Descrição da seção', multiline: true }),
                itemsField('items', 'Critérios', this.properties.items, { description: true, icon: true })
              ]
            }
          ]
        }
      ]
    };
  }
}
