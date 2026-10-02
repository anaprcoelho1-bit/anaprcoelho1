import * as React from 'react';
import { type IPropertyPaneConfiguration } from '@microsoft/sp-property-pane';
import { type IPortfolioComponentProps, PortfolioWebPartBase } from '../../common/portfolio/PortfolioWebPartBase';
import PortfolioReport, { type IPortfolioReportSettings } from './components/PortfolioReport';

export default class PortfolioReportWebPart extends PortfolioWebPartBase<IPortfolioReportSettings> {
  protected get defaultProperties(): IPortfolioReportSettings {
    return {
      title: 'Relatório Executivo do Portfólio',
      subtitle: 'Síntese para a alta gestão: indicadores, alertas, composição, decisões do período e roadmap.',
      ...this.sourceDefaults()
    };
  }

  protected get component(): React.FC<IPortfolioComponentProps<IPortfolioReportSettings>> {
    return PortfolioReport;
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: 'Relatório executivo (máx. 2 páginas).' },
          groups: [this.textGroup(), this.sourceGroup()]
        }
      ]
    };
  }
}
