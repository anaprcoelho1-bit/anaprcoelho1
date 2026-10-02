import * as React from 'react';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField
} from '@microsoft/sp-property-pane';
import { BaseSectionWebPart } from '../../common/BaseSectionWebPart';
import { itemsField } from '../../common/propertyPane';
import ProcessSteps, { type IProcessStepsProps } from './components/ProcessSteps';

export default class ProcessStepsWebPart extends BaseSectionWebPart<IProcessStepsProps> {
  protected get defaultProperties(): IProcessStepsProps {
    return {
      title: 'Como funciona?',
      subtitle: 'Da necessidade ao resultado, um processo claro e transparente.',
      items: [
        { title: 'Necessidade identificada', description: 'Problema, oportunidade ou demanda.', icon: 'Lightbulb' },
        { title: 'Registro da iniciativa', description: 'Informações sobre objetivo, público e contexto.', icon: 'TextDocument' },
        { title: 'Análise', description: 'Avaliação de valor, viabilidade, riscos e dependências.', icon: 'Search' },
        { title: 'Priorização', description: 'Comparação das iniciativas e definição de prioridades.', icon: 'BulletedList' },
        { title: 'Decisão', description: 'Aprovação, ajuste, postergação ou encerramento.', icon: 'CheckMark' },
        { title: 'Acompanhamento', description: 'Execução e evolução das iniciativas no portfólio.', icon: 'Settings' },
        { title: 'Revisão', description: 'Avaliação contínua para garantir aderência às prioridades.', icon: 'Sync' }
      ]
    };
  }

  protected renderSection(properties: IProcessStepsProps): React.ReactElement {
    return React.createElement(ProcessSteps, properties);
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: 'Etapas do processo de Gestão de Portfólio.' },
          groups: [
            {
              groupName: 'Conteúdo',
              groupFields: [
                PropertyPaneTextField('title', { label: 'Título da seção' }),
                PropertyPaneTextField('subtitle', { label: 'Descrição da seção', multiline: true }),
                itemsField('items', 'Etapas', this.properties.items, { description: true, icon: true })
              ]
            }
          ]
        }
      ]
    };
  }
}
