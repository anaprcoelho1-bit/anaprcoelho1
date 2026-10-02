import * as React from 'react';
import { type IPropertyPaneConfiguration } from '@microsoft/sp-property-pane';
import { type IPortfolioComponentProps, PortfolioWebPartBase } from '../../common/portfolio/PortfolioWebPartBase';
import PortfolioPrioritization, { type IPortfolioPrioritizationSettings } from './components/PortfolioPrioritization';

export default class PortfolioPrioritizationWebPart extends PortfolioWebPartBase<IPortfolioPrioritizationSettings> {
  protected get defaultProperties(): IPortfolioPrioritizationSettings {
    return {
      title: 'Priorização do Portfólio',
      subtitle: 'Registro, análise de elegibilidade e Matriz de Avaliação e Priorização: notas, Valor Ponderado (VP), Custo-Risco Ponderado (CR) e Índice de Prioridade do Portfólio (IPP).',
      ...this.sourceDefaults()
    };
  }

  protected get component(): React.FC<IPortfolioComponentProps<IPortfolioPrioritizationSettings>> {
    return PortfolioPrioritization;
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: 'Fila de entrada e Matriz de Avaliação e Priorização.' },
          groups: [this.textGroup(), this.sourceGroup()]
        }
      ]
    };
  }
}
